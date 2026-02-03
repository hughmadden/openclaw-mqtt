import mqtt, { MqttClient, IClientOptions } from "mqtt";
import type { MqttConfig } from "./config-schema.js";
import { mergeWithEnv } from "./env.js";

export interface MqttClientManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, message: string, qos?: 0 | 1 | 2): Promise<void>;
  subscribe(topic: string, handler: MessageHandler): void;
  isConnected(): boolean;
}

export type MessageHandler = (topic: string, payload: Buffer) => void;

interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

const DEFAULT_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60000;

/**
 * MQTT Client Manager
 * 
 * Handles connection lifecycle, reconnection, and message routing.
 */
export function createMqttClient(
  rawConfig: Partial<MqttConfig>,
  logger: Logger
): MqttClientManager {
  const config = mergeWithEnv(rawConfig);
  let client: MqttClient | null = null;
  let messageHandlers: Map<string, MessageHandler[]> = new Map();
  let reconnectAttempts = 0;

  function getClientOptions(): IClientOptions {
    const options: IClientOptions = {
      clientId: config.clientId ?? `openclaw-${Math.random().toString(36).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: DEFAULT_RECONNECT_MS,
    };

    // Auth
    if (config.username) {
      options.username = config.username;
    }
    if (config.password) {
      options.password = config.password;
    }

    // TLS
    if (config.tls?.enabled) {
      options.rejectUnauthorized = config.tls.rejectUnauthorized ?? true;
      if (config.tls.ca) {
        // Note: In production, read the CA file
        // options.ca = fs.readFileSync(config.tls.ca);
      }
    }

    return options;
  }

  async function connect(): Promise<void> {
    if (client?.connected) {
      logger.debug("MQTT already connected");
      return;
    }

    return new Promise((resolve, reject) => {
      logger.info(`Connecting to MQTT broker: ${config.brokerUrl}`);
      
      const options = getClientOptions();
      client = mqtt.connect(config.brokerUrl, options);

      client.on("connect", () => {
        logger.info("MQTT connected");
        reconnectAttempts = 0;
        
        // Resubscribe to all topics
        for (const topic of messageHandlers.keys()) {
          client?.subscribe(topic, { qos: config.qos }, (err) => {
            if (err) {
              logger.error(`Failed to subscribe to ${topic}: ${err.message}`);
            } else {
              logger.debug(`Subscribed to ${topic}`);
            }
          });
        }
        
        resolve();
      });

      client.on("message", (topic, payload) => {
        logger.debug(`Received message on ${topic}: ${payload.length} bytes`);
        const handlers = [...(messageHandlers.get(topic) ?? [])];
        
        // Also check wildcard subscriptions (skip exact match to avoid duplicates)
        for (const [pattern, patternHandlers] of messageHandlers) {
          if (pattern === topic) continue;
          if (topicMatches(pattern, topic)) {
            handlers.push(...patternHandlers);
          }
        }
        
        for (const handler of handlers) {
          try {
            handler(topic, payload);
          } catch (err) {
            logger.error(`Message handler error: ${err}`);
          }
        }
      });

      client.on("error", (err) => {
        logger.error(`MQTT error: ${err.message}`);
        reject(err);
      });

      client.on("close", () => {
        logger.warn("MQTT connection closed");
      });

      client.on("reconnect", () => {
        reconnectAttempts++;
        const backoff = Math.min(
          DEFAULT_RECONNECT_MS * Math.pow(2, reconnectAttempts),
          MAX_RECONNECT_MS
        );
        logger.info(`MQTT reconnecting (attempt ${reconnectAttempts}, backoff ${backoff}ms)`);
      });

      client.on("offline", () => {
        logger.warn("MQTT client offline");
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!client?.connected) {
          reject(new Error("MQTT connection timeout"));
        }
      }, 15000);
    });
  }

  async function disconnect(): Promise<void> {
    if (!client) return;

    return new Promise((resolve) => {
      logger.info("Disconnecting from MQTT broker");
      client?.end(false, {}, () => {
        client = null;
        messageHandlers.clear();
        logger.info("MQTT disconnected");
        resolve();
      });
    });
  }

  async function publish(
    topic: string,
    message: string,
    qos: 0 | 1 | 2 = config.qos
  ): Promise<void> {
    if (!client?.connected) {
      throw new Error("MQTT not connected");
    }

    return new Promise((resolve, reject) => {
      client!.publish(topic, message, { qos }, (err) => {
        if (err) {
          logger.error(`Failed to publish to ${topic}: ${err.message}`);
          reject(err);
        } else {
          logger.debug(`Published to ${topic}: ${message.slice(0, 100)}...`);
          resolve();
        }
      });
    });
  }

  function subscribe(topic: string, handler: MessageHandler): void {
    const handlers = messageHandlers.get(topic) ?? [];
    handlers.push(handler);
    messageHandlers.set(topic, handlers);

    // If already connected, subscribe immediately
    if (client?.connected) {
      client.subscribe(topic, { qos: config.qos }, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}: ${err.message}`);
        } else {
          logger.debug(`Subscribed to ${topic}`);
        }
      });
    }
  }

  function isConnected(): boolean {
    return client?.connected ?? false;
  }

  return {
    connect,
    disconnect,
    publish,
    subscribe,
    isConnected,
  };
}

/**
 * Check if a topic matches a subscription pattern.
 * Supports MQTT wildcards: + (single level) and # (multi level)
 */
function topicMatches(pattern: string, topic: string): boolean {
  if (pattern === topic) return true;
  if (!pattern.includes("+") && !pattern.includes("#")) return false;

  const patternParts = pattern.split("/");
  const topicParts = topic.split("/");

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];

    if (p === "#") {
      // # matches everything from here
      return true;
    }

    if (p === "+") {
      // + matches exactly one level
      if (i >= topicParts.length) return false;
      continue;
    }

    if (p !== topicParts[i]) {
      return false;
    }
  }

  return patternParts.length === topicParts.length;
}
