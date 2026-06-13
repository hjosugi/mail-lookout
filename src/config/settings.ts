/**
 * User-editable settings.
 *
 * The base config ships in code (defaults.ts). Two values are also
 * editable per user from the Settings task pane: the internal domains
 * that decide who counts as external, and the default send-delay. They
 * are kept in local storage — the same origin-scoped store the send
 * handler and panes already share — so a change made in the Settings
 * pane is read by the send handler and the review pane. (Per device; a
 * future version could roam them with Office roaming settings.)
 */

import { defaultConfig } from "./defaults"
import { configSchema, type Config } from "./types"

const SETTINGS_STORAGE_KEY = "mail-lookout:settings"

/** The two values exposed in the Settings pane. */
export interface UserSettings {
  readonly internalDomains: readonly string[]
  readonly sendDelaySeconds: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** The effective settings shown in the pane: saved overrides, or defaults. */
export function currentSettings(storage: StorageLike = window.localStorage): UserSettings {
  const config = loadConfig(storage)
  return {
    internalDomains: config.internalDomains,
    sendDelaySeconds: config.sendDelaySeconds,
  }
}

/** Persist the user's settings. Throws if they don't pass validation. */
export function saveSettings(settings: UserSettings, storage: StorageLike = window.localStorage): void {
  // Validate by building the full config; a bad value throws here rather
  // than being written and failing later at send time.
  configSchema.parse({ ...defaultConfig, ...normalize(settings) })
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalize(settings)))
}

export function clearSettings(storage: StorageLike = window.localStorage): void {
  try {
    storage.removeItem(SETTINGS_STORAGE_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/**
 * The effective config: defaults overlaid with the saved settings.
 *
 * Any missing or invalid stored value falls back to the default, so a
 * corrupt entry can never break the send path.
 */
export function loadConfig(storage: StorageLike = window.localStorage): Config {
  let raw: string | null
  try {
    raw = storage.getItem(SETTINGS_STORAGE_KEY)
  } catch {
    return defaultConfig
  }
  if (!raw) {
    return defaultConfig
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaultConfig
  }

  const overrides: { internalDomains?: readonly string[]; sendDelaySeconds?: number } = {}
  if (isRecord(parsed)) {
    const domains = asDomains(parsed.internalDomains)
    if (domains) {
      overrides.internalDomains = domains
    }
    const delay = asDelay(parsed.sendDelaySeconds)
    if (delay !== null) {
      overrides.sendDelaySeconds = delay
    }
  }

  try {
    return configSchema.parse({ ...defaultConfig, ...overrides })
  } catch {
    return defaultConfig
  }
}

/** Clean a settings object before it is validated or stored. */
function normalize(settings: UserSettings): UserSettings {
  return {
    internalDomains: dedupe(
      settings.internalDomains.map(domain => domain.trim().toLowerCase()).filter(Boolean),
    ),
    sendDelaySeconds: Math.max(0, Math.floor(settings.sendDelaySeconds)),
  }
}

function dedupe(items: readonly string[]): string[] {
  return [...new Set(items)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asDomains(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const domains = dedupe(
    value
      .filter((item): item is string => typeof item === "string")
      .map(item => item.trim().toLowerCase())
      .filter(Boolean),
  )
  return domains.length > 0 ? domains : null
}

function asDelay(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null
}
