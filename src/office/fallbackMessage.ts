/**
 * The built-in fallback prompt text.
 *
 * The fallback runs when the rich dialog cannot open. Its prompt is
 * plain text plus a little markdown (bold and simple lists, where each
 * item ends with a carriage return). This module is pure — no Office,
 * no DOM — so the combinations that matter (external recipients,
 * forgotten attachment, empty subject) can be unit tested.
 */

import { getMessages } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import type { ReviewModel } from "../domain/review"

/** A plain-text and markdown pair for the fallback prompt. */
export interface FallbackMessage {
  readonly text: string
  readonly markdown: string
}

/** Build the fallback message from the model. */
export function buildFallbackMessage(model: ReviewModel, locale: LocaleTag): FallbackMessage {
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
