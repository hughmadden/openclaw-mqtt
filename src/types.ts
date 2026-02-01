import type { CoreConfig } from "openclaw/plugin-sdk";
import type { MqttConfig } from "./config-schema.js";

export interface MqttChannelConfig {
  channels?: {
    mqtt?: MqttConfig;
  };
}

export type MqttCoreConfig = CoreConfig & MqttChannelConfig;

export interface MqttInboundMessage {
  topic: string;
  payload: string | Buffer;
  qos: 0 | 1 | 2;
  retain: boolean;
  timestamp: number;
}

export interface MqttOutboundMessage {
  topic?: string; // uses config default if not specified
  payload: string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}
