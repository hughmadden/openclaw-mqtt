import type { MqttConfig } from "./config-schema.js";

/**
 * Environment variable names for MQTT config.
 * These override values from openclaw.json for sensitive data.
 */
export const ENV_VARS = {
  BROKER_URL: "MQTT_BROKER_URL",
  USERNAME: "MQTT_USERNAME",
  PASSWORD: "MQTT_PASSWORD",
  CLIENT_ID: "MQTT_CLIENT_ID",
  CA_PATH: "MQTT_CA_PATH",
} as const;

/**
 * Merge config from openclaw.json with environment variables.
 * Environment variables take precedence (recommended for secrets).
 */
export function mergeWithEnv(config: Partial<MqttConfig>): MqttConfig {
  return {
    brokerUrl: process.env[ENV_VARS.BROKER_URL] ?? config.brokerUrl ?? "",
    username: process.env[ENV_VARS.USERNAME] ?? config.username,
    password: process.env[ENV_VARS.PASSWORD] ?? config.password,
    clientId: process.env[ENV_VARS.CLIENT_ID] ?? config.clientId,
    topics: config.topics ?? {
      inbound: "openclaw/inbound",
      outbound: "openclaw/outbound",
    },
    qos: config.qos ?? 1,
    tls: config.tls
      ? {
          ...config.tls,
          ca: process.env[ENV_VARS.CA_PATH] ?? config.tls.ca,
        }
      : undefined,
  };
}
