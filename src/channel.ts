import type { ChannelPlugin, InboundMessage } from "openclaw/plugin-sdk";
import type { MqttCoreConfig } from "./types.js";
import { createMqttClient, MqttClientManager } from "./client.js";
import { mqttOnboardingAdapter } from "./onboarding.js";
import { getMqttRuntime } from "./runtime.js";

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
      if (!mqtt) return { accountId: accountId ?? "default", enabled: false };
      return {
        accountId: accountId ?? "default",
        enabled: mqtt.enabled !== false,
        brokerUrl: mqtt.brokerUrl,
        config: mqtt,
      };
    },

    isEnabled: (account: any) => account.enabled !== false,
    isConfigured: (account: any) => Boolean(account.brokerUrl),
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
    startAccount: async (ctx: any) => {
      const { cfg, account, accountId, abortSignal, log } = ctx;
      const runtime = getMqttRuntime();

      const mqtt = cfg.channels?.mqtt;
      if (!mqtt?.brokerUrl) {
        log?.debug?.("MQTT channel not configured, skipping");
        return;
      }

      log?.info?.(`[${accountId}] starting MQTT provider (${mqtt.brokerUrl})`);

      // Create and connect client
      mqttClient = createMqttClient(mqtt, {
        debug: (msg: string) => log?.debug?.(`[MQTT] ${msg}`),
        info: (msg: string) => log?.info?.(`[MQTT] ${msg}`),
        warn: (msg: string) => log?.warn?.(`[MQTT] ${msg}`),
        error: (msg: string) => log?.error?.(`[MQTT] ${msg}`),
      });

      try {
        await mqttClient.connect();
      } catch (err) {
        log?.error?.(`MQTT connection failed: ${err}`);
        throw err;
      }

      // Subscribe to inbound topic
      const inboundTopic = mqtt.topics?.inbound ?? "openclaw/inbound";
      mqttClient.subscribe(inboundTopic, (topic: string, payload: Buffer) => {
        handleInboundMessage(topic, payload, runtime, log, accountId);
      });

      log?.info?.(`[${accountId}] MQTT channel ready, subscribed to ${inboundTopic}`);

      // Return a promise that resolves when aborted
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          if (mqttClient) {
            log?.info?.(`[${accountId}] MQTT channel stopping`);
            mqttClient.disconnect().finally(() => {
              mqttClient = null;
              resolve();
            });
          } else {
            resolve();
          }
        };

        if (abortSignal) {
          abortSignal.addEventListener("abort", cleanup, { once: true });
        }
      });
    },
  },

  // Onboarding adapter for `openclaw configure channels`
  onboarding: mqttOnboardingAdapter,
};

/**
 * Handle inbound MQTT message and inject into OpenClaw as a system event
 */
function handleInboundMessage(
  topic: string,
  payload: Buffer,
  runtime: any,
  log: any,
  accountId: string
) {
  try {
    const text = payload.toString("utf-8");
    log?.info?.(`Inbound MQTT message on ${topic}: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`);

    // Try to parse as JSON for structured messages
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(text);
    } catch {
      // Not JSON, use as plain text
      parsedPayload = null;
    }

    // Extract message text and sender
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

    // Format as system event with context
    const systemEventText = `[MQTT/${senderId}] ${messageText}`;
    
    // Enqueue as system event to main session
    runtime.system.enqueueSystemEvent(systemEventText, {
      sessionKey: "agent:main:main",
    });

    log?.info?.(`MQTT message enqueued as system event from ${senderId}`);
  } catch (err) {
    log?.error?.(`Failed to process MQTT message: ${err}`);
  }
}
