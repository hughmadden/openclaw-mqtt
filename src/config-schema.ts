import { z } from "zod";

/**
 * MQTT Configuration Schema
 *
 * Values can come from:
 * 1. ~/.openclaw/openclaw.json (channels.mqtt.*)
 * 2. Environment variables (MQTT_*)
 *
 * Environment variables take precedence for secrets.
 */
export const mqttConfigSchema = z.object({
  // Connection - env: MQTT_BROKER_URL
  brokerUrl: z.string().url().describe("MQTT broker URL"),
  // Auth - env: MQTT_USERNAME, MQTT_PASSWORD (recommended for secrets)
  username: z.string().optional().describe("Broker username"),
  password: z.string().optional().describe("Broker password"),
  // Client - env: MQTT_CLIENT_ID
  clientId: z.string().optional().describe("MQTT client ID"),
  topics: z
    .object({
      inbound: z.string().default("openclaw/inbound"),
      outbound: z.string().default("openclaw/outbound"),
    })
    .default({}),
  qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
  tls: z
    .object({
      enabled: z.boolean().default(false),
      rejectUnauthorized: z.boolean().default(true),
      ca: z.string().optional(),
    })
    .optional(),
});

export type MqttConfig = z.infer<typeof mqttConfigSchema>;

export const defaultConfig: Partial<MqttConfig> = {
  topics: {
    inbound: "openclaw/inbound",
    outbound: "openclaw/outbound",
  },
  qos: 1,
};
