/**
 * User-editable settings — the merge and validation logic.
 *
 * The base config ships in code (defaults.ts). Two values are also
 * editable per user: the internal domains that decide who counts as
 * external, and the default send-delay. This module is pure — it only
 * overlays untrusted override values onto the defaults and validates
 * them. Where the values are stored (Outlook roaming settings) lives in
 * the office layer, so this stays testable and Office-free.
 */

import { defaultConfig } from "./defaults"
import { configSchema, type Config } from "./types"

/** The two values exposed in the Settings pane. */
export interface UserSettings {
  readonly internalDomains: readonly string[]
  readonly sendDelaySeconds: number
}

/** Raw, possibly-invalid override values as they come out of storage. */
interface SettingsOverrides {
  readonly internalDomains?: unknown
  readonly sendDelaySeconds?: unknown
}

/**
 * The effective config: defaults overlaid with the saved overrides.
 *
 * Any missing or invalid value falls back to its default, so corrupt
 * stored data can never break the send path.
 */
export function applySettings(overrides: SettingsOverrides): Config {
  const merged: { internalDomains?: readonly string[]; sendDelaySeconds?: number } = {}
  const domains = asDomains(overrides.internalDomains)
  if (domains) {
    merged.internalDomains = domains
  }
  const delay = asDelay(overrides.sendDelaySeconds)
  if (delay !== null) {
    merged.sendDelaySeconds = delay
  }

  try {
    return configSchema.parse({ ...defaultConfig, ...merged })
  } catch {
    return defaultConfig
  }
}

/**
 * Clean a settings object before it is stored, and validate it.
 *
 * Throws if the result is invalid (for example, no internal domains), so
 * the caller can surface the error instead of saving a broken config.
 */
export function normalizeSettings(settings: UserSettings): UserSettings {
  const internalDomains = dedupe(
    settings.internalDomains.map(domain => domain.trim().toLowerCase()).filter(Boolean),
  )
  const sendDelaySeconds = Math.max(0, Math.floor(settings.sendDelaySeconds))
  configSchema.parse({ ...defaultConfig, internalDomains, sendDelaySeconds })
  return { internalDomains, sendDelaySeconds }
}

/** The effective settings (saved overrides, or the defaults). */
export function settingsFromConfig(config: Config): UserSettings {
  return {
    internalDomains: config.internalDomains,
    sendDelaySeconds: config.sendDelaySeconds,
  }
}

function dedupe(items: readonly string[]): string[] {
  return [...new Set(items)]
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
