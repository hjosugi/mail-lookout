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

import { applySettings, normalizeSettings, settingsFromConfig } from "../config/settings"
import type { UserSettings } from "../config/settings"
import { defaultConfig } from "../config/defaults"
import type { Config } from "../config/types"

const KEY_DOMAINS = "internalDomains"
const KEY_DELAY = "sendDelaySeconds"
const KEY_RECIPIENTS = "requireRecipientConfirmation"
const KEY_ATTACHMENTS = "requireAttachmentConfirmation"
const KEY_BODY = "requireBodyConfirmation"
const KEY_SEND_ANYWAY = "allowSendAnyway"

/** Every key this add-in owns, so a reset cannot leave one behind. */
const allKeys = [KEY_DOMAINS, KEY_DELAY, KEY_RECIPIENTS, KEY_ATTACHMENTS, KEY_BODY, KEY_SEND_ANYWAY]

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
  // This runs on the send path, where a throw escaping the handler means
  // Outlook never hears back and the send stalls. Reading the settings
  // bag is not worth that risk: a failed read falls back to the defaults.
  try {
    return applySettings({
      internalDomains: settings.get(KEY_DOMAINS),
      sendDelaySeconds: settings.get(KEY_DELAY),
      requireRecipientConfirmation: settings.get(KEY_RECIPIENTS),
      requireAttachmentConfirmation: settings.get(KEY_ATTACHMENTS),
      requireBodyConfirmation: settings.get(KEY_BODY),
      allowSendAnyway: settings.get(KEY_SEND_ANYWAY),
    })
  } catch {
    return defaultConfig
  }
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
  store.set(KEY_RECIPIENTS, clean.requireRecipientConfirmation)
  store.set(KEY_ATTACHMENTS, clean.requireAttachmentConfirmation)
  store.set(KEY_BODY, clean.requireBodyConfirmation)
  store.set(KEY_SEND_ANYWAY, clean.allowSendAnyway)
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
  for (const key of allKeys) {
    store.remove(key)
  }
  store.saveAsync(result => {
    callback(result.status === Office.AsyncResultStatus.Succeeded)
  })
}
