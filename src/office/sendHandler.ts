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
 *   - If the rich dialog cannot open, fall back to the built-in
 *     prompt so the user still sees a confirmation.
 *   - On any unexpected error, cancel the send rather than sending
 *     without a confirmation.
 */

import { defaultConfig } from "../config"
import { buildReviewModel } from "../domain/review"
import type { ReviewModel } from "../domain/review"
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
 * No sendModeOverride here. Under SoftBlock this shows our
 * message with a single "back to draft" action. The user is not
 * offered a redundant "send anyway", which is the point of a
 * confirmation tool.
 */
function cancelOptions(locale: LocaleTag): Office.SmartAlertsEventCompletedOptions {
  const messages = getMessages(locale)
  return {
    allowEvent: false,
    errorMessage: messages.cancel.notSent,
    cancelLabel: messages.cancel.returnLabel,
  }
}

/** A plain-text and markdown pair for the fallback prompt. */
interface FallbackMessage {
  readonly text: string
  readonly markdown: string
}

/**
 * Build the fallback message from the model.
 *
 * The built-in prompt is plain. Markdown supports only bold and
 * simple lists, where each item ends with a carriage return.
 */
function buildFallbackMessage(model: ReviewModel, locale: LocaleTag): FallbackMessage {
  const messages = getMessages(locale)
  const f = messages.fallback

  const lines: string[] = []
  const mdLines: string[] = []

  if (model.externalEmails.length > 0) {
    lines.push(f.externalLine(model.externalEmails.length))
    mdLines.push(`**${f.externalLine(model.externalEmails.length)}**`)
    for (const email of model.externalEmails) {
      lines.push(`  - ${email}`)
      mdLines.push(`- ${email}\r`)
    }
  }

  const hasForgotten = model.warnings.some(w => w.kind === "forgottenAttachment")
  if (hasForgotten) {
    lines.push(f.forgottenAttachmentLine)
    mdLines.push(`**${f.forgottenAttachmentLine}**`)
  }

  const hasEmptySubject = model.warnings.some(w => w.kind === "emptySubject")
  if (hasEmptySubject) {
    lines.push(f.emptySubjectLine)
    mdLines.push(`**${f.emptySubjectLine}**`)
  }

  lines.push(f.reviewLine)
  mdLines.push(f.reviewLine)

  return { text: lines.join("\n"), markdown: mdLines.join("\n") }
}

/**
 * Respond using the built-in prompt instead of the rich dialog.
 *
 * This is still a confirmation path. Even when there are no warnings,
 * the user sees the host prompt instead of sending without review.
 */
function respondWithFallback(
  complete: (options: Office.SmartAlertsEventCompletedOptions) => void,
  model: ReviewModel,
  locale: LocaleTag,
): void {
  const fallback = buildFallbackMessage(model, locale)
  complete({
    allowEvent: false,
    errorMessage: fallback.text,
    errorMessageMarkdown: fallback.markdown,
    // When the rich dialog is down, use the host prompt so the
    // user still gets a confirmation instead of a silent send.
    sendModeOverride: Office.MailboxEnums.SendModeOverride.PromptUser,
  })
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

    // The rich dialog needs messageChild, which is DialogApi 1.2.
    // Without it, use the fallback prompt.
    if (!Office.context.requirements.isSetSupported("DialogApi", "1.2")) {
      respondWithFallback(complete, model, locale)
      return
    }

    const origin = window.location.origin
    try {
      const allow = await showConfirmationDialog(model, locale, config, origin)
      complete(allow ? { allowEvent: true } : cancelOptions(locale))
    } catch (error) {
      if (error instanceof DialogUnavailableError) {
        respondWithFallback(complete, model, locale)
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
