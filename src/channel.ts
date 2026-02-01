import type { ChannelPlugin, InboundMessage } from "openclaw/plugin-sdk";
import type { MqttCoreConfig } from "./types.js";
import { createMqttClient, MqttClientManager } from "./client.js";

// Global client instance (one per gateway lifecycle)
let mqttClient: MqttClientManager | null = null;

/**
 * MQTT Channel Plugin for OpenClaw
 *
 * Provides bidirectional messaging via MQTT brokers (Mosquitto, EMQX, etc.)
 * Useful for IoT integration, home automation alerts, and service monitoring.
 */
export const mqttPlugin: ChannelPlugin<MqttCoreConfig> = {
  id: "mqtt",

  meta: {
    id: "mqtt",
    label: "MQTT",
    selectionLabel: "MQTT (IoT/Home Automation)",
    docsPath: "/channels/mqtt",
    blurb: "Bidirectional messaging via MQTT brokers",
    aliases: ["mosquitto"],
  },

  capabilities: {
    chatTypes: ["direct"],
    // MQTT is primarily machine-to-machine, so limited chat features
    supportsMedia: false,
    supportsReactions: false,
    supportsThreads: false,
  },

  config: {
    listAccountIds: (cfg: any) => {
      // Single account for now (the broker connection)
      return cfg.channels?.mqtt?.brokerUrl ? ["default"] : [];
    },

    resolveAccount: (cfg: any, accountId: any) => {
      const mqtt = cfg.channels?.mqtt;
      if (!mqtt) return { accountId: accountId ?? "default" };
      return {
        accountId: accountId ?? "default",
        brokerUrl: mqtt.brokerUrl,
      };
    },
  },

  outbound: {
    deliveryMode: "direct",

    async sendText({ text, cfg }: { text: string; cfg: any }) {
      const mqtt = cfg.channels?.mqtt;
      if (!mqtt?.brokerUrl) {
        return { ok: false, error: "MQTT not configured" };
      }

      if (!mqttClient || !mqttClient.isConnected()) {
        return { ok: false, error: "MQTT not connected" };
      }

      try {
        const topic = mqtt.topics?.outbound ?? "openclaw/outbound";
        await mqttClient.publish(topic, text, mqtt.qos);
        return { ok: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  },

  // Gateway lifecycle hooks
  gateway: {
    async start({ cfg, logger, injectMessage }: { cfg: any; logger: any; injectMessage: any }) {
      const mqtt = cfg.channels?.mqtt;
      if (!mqtt?.brokerUrl) {
        logger.debug("MQTT channel not configured, skipping");
        return;
      }

      logger.info(`MQTT channel starting, broker: ${mqtt.brokerUrl}`);

      // Create and connect client
      mqttClient = createMqttClient(mqtt, {
        debug: (msg) => logger.debug(`[MQTT] ${msg}`),
        info: (msg) => logger.info(`[MQTT] ${msg}`),
        warn: (msg) => logger.warn(`[MQTT] ${msg}`),
        error: (msg) => logger.error(`[MQTT] ${msg}`),
      });

      try {
        await mqttClient.connect();
      } catch (err) {
        logger.error(`MQTT connection failed: ${err}`);
        return;
      }

      // Subscribe to inbound topic
      const inboundTopic = mqtt.topics?.inbound ?? "openclaw/inbound";
      mqttClient.subscribe(inboundTopic, (topic, payload) => {
        handleInboundMessage(topic, payload, injectMessage, logger);
      });

      logger.info(`MQTT channel ready, subscribed to ${inboundTopic}`);
    },

    async stop({ logger }: { logger: any }) {
      if (mqttClient) {
        logger.info("MQTT channel stopping");
        await mqttClient.disconnect();
        mqttClient = null;
      }
    },
  },
};

/**
 * Handle inbound MQTT message and inject into OpenClaw
 */
function handleInboundMessage(
  topic: string,
  payload: Buffer,
  injectMessage: (msg: InboundMessage) => void,
  logger: { info: (msg: string) => void; error: (msg: string) => void }
) {
  try {
    const text = payload.toString("utf-8");
    logger.info(`Inbound MQTT message on ${topic}: ${text.slice(0, 200)}...`);

    // Try to parse as JSON for structured messages
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(text);
    } catch {
      // Not JSON, use as plain text
      parsedPayload = null;
    }

    // Extract message text
    let messageText: string;
    let senderId = "mqtt";

    if (parsedPayload && typeof parsedPayload === "object") {
      const obj = parsedPayload as Record<string, unknown>;
      // Support common alert formats
      messageText =
        (obj.message as string) ??
        (obj.text as string) ??
        (obj.msg as string) ??
        (obj.alert as string) ??
        (obj.body as string) ??
        text;
      
      // Extract sender if available
      senderId =
        (obj.source as string) ??
        (obj.sender as string) ??
        (obj.from as string) ??
        (obj.service as string) ??
        topic.replace(/\//g, "-");
    } else {
      messageText = text;
      senderId = topic.replace(/\//g, "-");
    }

    // Inject message into OpenClaw
    injectMessage({
      channel: "mqtt",
      accountId: "default",
      chatType: "direct",
      senderId,
      senderName: senderId,
      text: messageText,
      timestamp: Date.now(),
      raw: {
        topic,
        payload: text,
        parsedPayload,
      },
    });
  } catch (err) {
    logger.error(`Failed to process MQTT message: ${err}`);
  }
}
