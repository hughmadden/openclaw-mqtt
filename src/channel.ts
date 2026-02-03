import type { ChannelPlugin } from "openclaw/plugin-sdk";
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
    supportsMedia: false,
    supportsReactions: false,
    supportsThreads: false,
  },

  config: {
    listAccountIds: (cfg: any) => {
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
      const outboundTopic = mqtt.topics?.outbound ?? "openclaw/outbound";
      
      mqttClient.subscribe(inboundTopic, async (topic: string, payload: Buffer) => {
        await handleInboundMessage({
          topic,
          payload,
          runtime,
          cfg,
          accountId,
          log,
          outboundTopic,
          qos: mqtt.qos,
        });
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

  onboarding: mqttOnboardingAdapter,
};

/**
 * Handle inbound MQTT message - process through OpenClaw agent and deliver reply
 */
async function handleInboundMessage(opts: {
  topic: string;
  payload: Buffer;
  runtime: any;
  cfg: any;
  accountId: string;
  log: any;
  outboundTopic: string;
  qos: number;
}) {
  const { topic, payload, runtime, cfg, accountId, log, outboundTopic, qos } = opts;

  try {
    const text = payload.toString("utf-8");
    log?.info?.(`Inbound MQTT message on ${topic}: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`);

    // Parse JSON if possible to extract structured data
    let parsedPayload: Record<string, unknown> | null = null;
    try {
      parsedPayload = JSON.parse(text);
    } catch {
      parsedPayload = null;
    }

    // Extract message body and sender from payload
    let messageBody: string;
    let senderId: string;

    if (parsedPayload && typeof parsedPayload === "object") {
      messageBody =
        (parsedPayload.message as string) ??
        (parsedPayload.text as string) ??
        (parsedPayload.msg as string) ??
        (parsedPayload.alert as string) ??
        (parsedPayload.body as string) ??
        text;

      senderId =
        (parsedPayload.senderId as string) ??
        (parsedPayload.source as string) ??
        (parsedPayload.sender as string) ??
        (parsedPayload.from as string) ??
        (parsedPayload.service as string) ??
        topic.replace(/\//g, "-");
    } else {
      messageBody = text;
      senderId = topic.replace(/\//g, "-");
    }

    // Build the inbound context using OpenClaw's standard format
    const ctxPayload = runtime.channel.reply.finalizeInboundContext({
      Body: messageBody,
      RawBody: text,
      CommandBody: messageBody,
      CommandAuthorized: true,
      From: `mqtt:${senderId}`,
      To: `mqtt:${accountId}`,
      SessionKey: `agent:main:mqtt:${senderId}`,
      AccountId: accountId,
      ChatType: "direct",
      ConversationLabel: `mqtt:${senderId}`,
      SenderName: senderId,
      SenderId: senderId,
      Provider: "mqtt",
      Surface: "mqtt",
      MessageSid: `mqtt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      Timestamp: Date.now(),
    });

    // inbound context logging removed

    // Dispatch through OpenClaw's reply system and publish replies
    await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg,
      dispatcherOptions: {
        deliver: async (payload: { text?: string; media?: any }, info: { kind: string }) => {
          if (!payload.text) {
            log?.debug?.(`MQTT: skipping empty ${info.kind} reply`);
            return;
          }

          log?.info?.(`MQTT reply (${info.kind}) [${payload.text.length} chars]`);

          if (mqttClient?.isConnected()) {
            try {
              const outboundPayload = JSON.stringify({
                senderId: "openclaw",
                text: payload.text,
                kind: info.kind,
                ts: Date.now(),
              });
              await mqttClient.publish(outboundTopic, outboundPayload, qos as 0 | 1 | 2);
              log?.info?.(`MQTT: sent reply to ${outboundTopic}`);
            } catch (err) {
              log?.error?.(`MQTT: failed to send reply: ${err}`);
            }
          } else {
            log?.warn?.(`MQTT: not connected, cannot send reply`);
          }
        },
        onSkip: (_payload: any, info: { reason: string }) => {
          log?.debug?.(`MQTT: skipped reply (${info.reason})`);
        },
        onError: (err: Error, info: { kind: string }) => {
          log?.error?.(`MQTT: ${info.kind} reply error: ${err}`);
        },
      },
      replyOptions: {
        disableBlockStreaming: true,
      },
    });

    // dispatch complete

    log?.info?.(`MQTT message processed from ${senderId}`);
  } catch (err) {
    log?.error?.(`Failed to process MQTT message: ${err}`);
  }
}
