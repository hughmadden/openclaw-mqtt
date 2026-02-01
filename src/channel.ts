import type { ChannelPlugin } from "openclaw/plugin-sdk";
import type { MqttCoreConfig } from "./types.js";

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
    listAccountIds: (cfg) => {
      // Single account for now (the broker connection)
      return cfg.channels?.mqtt?.brokerUrl ? ["default"] : [];
    },

    resolveAccount: (cfg, accountId) => {
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

    async sendText({ text, cfg }) {
      const mqtt = cfg.channels?.mqtt;
      if (!mqtt?.brokerUrl) {
        return { ok: false, error: "MQTT not configured" };
      }

      // TODO: Implement actual MQTT publish
      // const client = await getMqttClient(mqtt);
      // await client.publish(mqtt.topics?.outbound ?? "openclaw/outbound", text);

      console.log(`[MQTT] Would publish to ${mqtt.topics?.outbound}: ${text}`);
      return { ok: true };
    },
  },

  // Gateway lifecycle hooks
  gateway: {
    async start({ cfg, logger }) {
      const mqtt = cfg.channels?.mqtt;
      if (!mqtt?.brokerUrl) {
        logger.debug("MQTT channel not configured, skipping");
        return;
      }

      logger.info(`MQTT channel connecting to ${mqtt.brokerUrl}`);
      // TODO: Connect to broker, subscribe to inbound topic
      // const client = await connectMqtt(mqtt);
      // client.subscribe(mqtt.topics?.inbound ?? "openclaw/inbound");
      // client.on("message", (topic, payload) => handleInbound(topic, payload));
    },

    async stop({ logger }) {
      logger.info("MQTT channel disconnecting");
      // TODO: Disconnect from broker
      // await disconnectMqtt();
    },
  },
};
