/**
 * User-editable settings — the merge and validation logic.
 *
 * The base config ships in code (defaults.ts). A subset is also editable
 * per user: the internal domains that decide who counts as external, the
 * default send-delay, which items the review pane requires a check on,
 * and whether a blocked send offers Outlook's "Send Anyway". This module
 * is pure — it only overlays untrusted override values onto the defaults
 * and validates them. Where the values are stored (Outlook roaming
 * settings) lives in the office layer, so this stays testable and
 * Office-free.
 */

import { defaultConfig } from "./defaults"
import { configSchema, type Config } from "./types"

/** The values exposed in the Settings pane. */
export interface UserSettings {
  readonly internalDomains: readonly string[]
  readonly sendDelaySeconds: number
  readonly requireRecipientConfirmation: boolean
  readonly requireAttachmentConfirmation: boolean
  readonly requireBodyConfirmation: boolean
  readonly allowSendAnyway: boolean
}

/** Raw, possibly-invalid override values as they come out of storage. */
interface SettingsOverrides {
  readonly internalDomains?: unknown
  readonly sendDelaySeconds?: unknown
  readonly requireRecipientConfirmation?: unknown
  readonly requireAttachmentConfirmation?: unknown
  readonly requireBodyConfirmation?: unknown
  readonly allowSendAnyway?: unknown
}

/** The boolean settings, listed once so the overlay cannot miss one. */
const booleanKeys = [
  "requireRecipientConfirmation",
  "requireAttachmentConfirmation",
  "requireBodyConfirmation",
  "allowSendAnyway",
] as const

type BooleanKey = (typeof booleanKeys)[number]

/** Config is readonly by design; the overlay needs somewhere to build up. */
type ConfigOverlay = { -readonly [K in keyof Config]?: Config[K] }

/**
 * The effective config: defaults overlaid with the saved overrides.
 *
 * Any missing or invalid value falls back to its default, so corrupt
 * stored data can never break the send path.
 */
export function applySettings(overrides: SettingsOverrides): Config {
  const merged: ConfigOverlay = {}
  const domains = asDomains(overrides.internalDomains)
  if (domains) {
    merged.internalDomains = domains
  }
  const delay = asDelay(overrides.sendDelaySeconds)
  if (delay !== null) {
    merged.sendDelaySeconds = delay
  }
  for (const key of booleanKeys) {
    const value = overrides[key]
    if (typeof value === "boolean") {
      merged[key] = value
    }
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
  const booleans = pickBooleans(settings)
  configSchema.parse({ ...defaultConfig, internalDomains, sendDelaySeconds, ...booleans })
  return { internalDomains, sendDelaySeconds, ...booleans }
}

/** The effective settings (saved overrides, or the defaults). */
export function settingsFromConfig(config: Config): UserSettings {
  return {
    internalDomains: config.internalDomains,
    sendDelaySeconds: config.sendDelaySeconds,
    ...pickBooleans(config),
  }
}

/** Narrow either a Config or a UserSettings to just the boolean settings. */
function pickBooleans(source: Record<BooleanKey, boolean>): Record<BooleanKey, boolean> {
  return {
    requireRecipientConfirmation: source.requireRecipientConfirmation,
    requireAttachmentConfirmation: source.requireAttachmentConfirmation,
    requireBodyConfirmation: source.requireBodyConfirmation,
    allowSendAnyway: source.allowSendAnyway,
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
