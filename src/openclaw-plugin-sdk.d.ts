/**
 * Type declarations for openclaw/plugin-sdk
 * OpenClaw doesn't ship .d.ts files yet - using loose types for now.
 */
declare module "openclaw/plugin-sdk" {
  export const emptyPluginConfigSchema: any;
  export type OpenClawPluginApi = any;
  export type ChannelPlugin<T = any> = any;
  export type InboundMessage = any;
  export type PluginRuntime = any;
  export type CoreConfig = any;
}
