/**
 * Public surface of the config layer.
 */

export type { Config } from "./types"
export { defaultConfig } from "./defaults"
export { applySettings, normalizeSettings, settingsFromConfig } from "./settings"
export type { UserSettings } from "./settings"
