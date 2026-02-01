import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | undefined;

export function setMqttRuntime(r: PluginRuntime) {
  runtime = r;
}

export function getMqttRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("MQTT runtime not initialized");
  }
  return runtime;
}
