import { z } from "zod";

export const mqttConfigSchema = z.object({
  brokerUrl: z.string().url().describe("MQTT broker URL"),
  username: z.string().optional().describe("Broker username"),
  password: z.string().optional().describe("Broker password"),
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
