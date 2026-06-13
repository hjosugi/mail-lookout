/// <reference types="office-js" />

/**
 * The Smart Alerts handler.
 *
 * This runs when the user presses Send. It collects the message,
 * builds the review model, and uses Outlook's built-in Smart Alerts
 * dialog to show a review summary. If the user returns to the draft
 * and presses Send again without changing the message, the send is
 * allowed.
 *
 * Safety rules:
 *   - event.completed is called exactly once, always.
 *   - The first send attempt is canceled when confirmation is needed.
 *   - On any unexpected error, cancel the send rather than sending
 *     without a confirmation.
 */

import { defaultConfig } from "../config"
import { buildReviewModel } from "../domain/review"
import { collectSnapshot } from "./collect"
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import {
  consumeConfirmation,
  needsSmartAlertConfirmation,
  smartAlertCancelOptions,
  snapshotFingerprint,
} from "./smartAlert"
import { isCountdownActive } from "./reviewProgress"

/** Wrap event.completed so it can run at most once. */
function completeOnce(
  event: Office.AddinCommands.Event,
): (options: Office.SmartAlertsEventCompletedOptions) => void {
  let done = false
  return options => {
    if (done) {
      return
    }
    done = true
    event.completed(options)
  }
}

function failureOptions(
  locale: LocaleTag,
  error: unknown,
): Office.SmartAlertsEventCompletedOptions {
  const messages = getMessages(locale)
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return {
    allowEvent: false,
    errorMessage: `${messages.cancel.notSent}\n\nmail-lookout error: ${detail.slice(0, 180)}`,
    cancelLabel: messages.cancel.returnLabel,
  }
}

/**
 * The handler body.
 *
 * Exported so it can be associated with the Smart Alerts event.
 */
export async function onMessageSendHandler(event: Office.AddinCommands.Event): Promise<void> {
  const complete = completeOnce(event)
  const config = defaultConfig
  const locale = resolveLocale(Office.context.displayLanguage, config.fallbackLocale)

  try {
    const item = Office.context.mailbox.item as Office.MessageCompose
    const snapshot = await collectSnapshot(item)
    const model = buildReviewModel(snapshot, config)
    const fingerprint = snapshotFingerprint(snapshot)

    if (!needsSmartAlertConfirmation(model) || consumeConfirmation(fingerprint)) {
      complete({ allowEvent: true })
      return
    }

    // Block the send and open the review. The confirmation is recorded
    // only when the user completes the review (and its countdown) in the
    // task pane — not here — so closing the pane or sending again without
    // reviewing stays blocked. If a countdown is already running, the
    // alert points at the status pane instead.
    complete(smartAlertCancelOptions(locale, isCountdownActive(model, fingerprint)))
  } catch (error) {
    // Last resort. Never send real mail without a confirmation.
    console.error("mail-lookout: unexpected error in send handler", error)
    complete(failureOptions(locale, error))
  }
}
