/// <reference types="office-js" />

/**
 * Persist completion of the onboarding screen.
 *
 * Outlook roaming settings make the choice follow the mailbox across
 * devices. Browser storage is also written as a fallback for hosts where
 * roaming settings are temporarily unavailable.
 */

const FIRST_RUN_KEY = "firstRunExperienceVersion"
const FIRST_RUN_VERSION = 1
const LOCAL_STORAGE_KEY = `mail-lookout:first-run:v${FIRST_RUN_VERSION}`

function roamingSettings(): Office.RoamingSettings | undefined {
  return typeof Office !== "undefined" ? Office.context?.roamingSettings : undefined
}

function localCompletion(): boolean {
  try {
    return window.localStorage.getItem(LOCAL_STORAGE_KEY) === "complete"
  } catch {
    return false
  }
}

/** Whether this user has completed the current onboarding experience. */
export function isFirstRunComplete(): boolean {
  try {
    if (roamingSettings()?.get(FIRST_RUN_KEY) === FIRST_RUN_VERSION) {
      return true
    }
  } catch {
    // Fall through to the browser-storage copy.
  }
  return localCompletion()
}

/** Mark onboarding complete without delaying entry to the add-in. */
export function completeFirstRun(): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, "complete")
  } catch {
    // Roaming settings remain the primary store.
  }

  try {
    const settings = roamingSettings()
    if (!settings) {
      return
    }
    settings.set(FIRST_RUN_KEY, FIRST_RUN_VERSION)
    settings.saveAsync(result => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        console.warn("mail-lookout: could not save first-run completion", result.error)
      }
    })
  } catch (error) {
    console.warn("mail-lookout: could not save first-run completion", error)
  }
}
