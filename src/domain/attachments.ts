/**
 * Attachment rules.
 *
 * Two jobs here. First, tell real attachments from inline images.
 * Second, detect the classic mistake: the body says "see attached"
 * but no file is attached.
 */

import type { Attachment, MessageSnapshot } from "./types"
import { includesAnyCaseInsensitive } from "./text"

/** Keep only real attachments. Inline images are dropped. */
export function realAttachments(attachments: readonly Attachment[]): readonly Attachment[] {
  return attachments.filter(attachment => !attachment.isInline)
}

/**
 * Return true if the text mentions an attachment.
 *
 * The match is case-insensitive and checks for any keyword as a
 * substring. Empty keywords are skipped.
 */
export function mentionsAttachment(text: string, keywords: readonly string[]): boolean {
  return includesAnyCaseInsensitive(text, keywords)
}

/**
 * Detect a forgotten attachment.
 *
 * True only when there are no real attachments, but the subject
 * or body talks about one.
 */
export function detectForgottenAttachment(
  snapshot: MessageSnapshot,
  keywords: readonly string[],
): boolean {
  if (realAttachments(snapshot.attachments).length > 0) {
    return false
  }
  return (
    mentionsAttachment(snapshot.subject, keywords) || mentionsAttachment(snapshot.body, keywords)
  )
}
