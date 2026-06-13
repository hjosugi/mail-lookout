/// <reference types="office-js" />

/**
 * Read and write the user's settings in Outlook roaming settings.
 *
 * Roaming settings are stored per add-in, per user, in the mailbox, so
 * they follow the user across devices — unlike browser storage, which is
 * per device. The send handler and the review pane read the effective
 * config here; the Settings pane writes it.
 *
 * Caveat (by design in Outlook): roaming settings are a snapshot loaded
 * when the runtime initializes. A change saved in the Settings pane is
 * picked up by the next fresh runtime — the next send, or the next time
 * a pane opens — not by an already-loaded runtime mid-session.
 */

import {
  applySettings,
  defaultConfig,
  normalizeSettings,
  settingsFromConfig,
  type Config,
  type UserSettings,
} from "../config"

const KEY_DOMAINS = "internalDomains"
const KEY_DELAY = "sendDelaySeconds"

/** The roaming settings bag, or undefined where it isn't available. */
function roaming(): Office.RoamingSettings | undefined {
  return typeof Office !== "undefined" ? Office.context?.roamingSettings : undefined
}

/** The effective config: defaults overlaid with the saved roaming settings. */
export function loadConfig(): Config {
  const settings = roaming()
  if (!settings) {
    return defaultConfig
  }
  return applySettings({
    internalDomains: settings.get(KEY_DOMAINS),
    sendDelaySeconds: settings.get(KEY_DELAY),
  })
}

/** The effective settings to show in the Settings pane. */
export function currentSettings(): UserSettings {
  return settingsFromConfig(loadConfig())
}

/**
 * Persist the user's settings. The callback reports success.
 *
 * Invalid input (such as no internal domains) reports failure without
 * writing anything.
 */
export function saveSettings(settings: UserSettings, callback: (ok: boolean) => void): void {
  const store = roaming()
  if (!store) {
    callback(false)
    return
  }
  let clean: UserSettings
  try {
    clean = normalizeSettings(settings)
  } catch {
    callback(false)
    return
  }
  store.set(KEY_DOMAINS, [...clean.internalDomains])
  store.set(KEY_DELAY, clean.sendDelaySeconds)
  store.saveAsync(result => {
    callback(result.status === Office.AsyncResultStatus.Succeeded)
  })
}

/** Remove the saved settings so the defaults apply again. */
export function clearSettings(callback: (ok: boolean) => void): void {
  const store = roaming()
  if (!store) {
    callback(false)
    return
  }
  store.remove(KEY_DOMAINS)
  store.remove(KEY_DELAY)
  store.saveAsync(result => {
    callback(result.status === Office.AsyncResultStatus.Succeeded)
  })
}
