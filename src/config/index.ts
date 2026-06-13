/**
 * Public surface of the config layer.
 */

export type { Config } from "./types"
export { defaultConfig } from "./defaults"
export { loadConfig, currentSettings, saveSettings, clearSettings } from "./settings"
export type { UserSettings } from "./settings"
