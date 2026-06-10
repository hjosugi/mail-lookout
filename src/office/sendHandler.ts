/// <reference types="office-js" />

/**
 * The Smart Alerts handler.
 *
 * This runs when the user presses Send. It collects the message,
 * builds the review model, and shows the confirmation dialog.
 * Then it allows or cancels the send.
 *
 * Safety rules:
 *   - event.completed is called exactly once, always.
 *   - If the rich dialog cannot open, cancel the send.
 *   - On any unexpected error, cancel the send rather than sending
 *     without a confirmation.
 */

import { defaultConfig } from "../config"
import { buildReviewModel } from "../domain/review"
import { collectSnapshot } from "./collect"
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import { DialogUnavailableError, showConfirmationDialog } from "./dialog"

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

/**
 * Options that cancel the send cleanly.
 *
 * Under SoftBlock this shows our message with a single "back to draft"
 * action. There is intentionally no "send anyway" path.
 */
function cancelOptions(locale: LocaleTag): Office.SmartAlertsEventCompletedOptions {
  const messages = getMessages(locale)
  return {
    allowEvent: false,
    errorMessage: messages.cancel.notSent,
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

    const origin = window.location.origin
    try {
      const allow = await showConfirmationDialog(model, locale, config, origin)
      complete(allow ? { allowEvent: true } : cancelOptions(locale))
    } catch (error) {
      if (error instanceof DialogUnavailableError) {
        complete(cancelOptions(locale))
      } else {
        throw error
      }
    }
  } catch (error) {
    // Last resort. Never send real mail without a confirmation.
    console.error("mail-lookout: unexpected error in send handler", error)
    complete(cancelOptions(locale))
  }
}
