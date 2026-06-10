/**
 * The core of the add-in.
 *
 * Two things live here. First, buildReviewModel turns a raw
 * message snapshot plus config into a ReviewModel: a flat,
 * JSON-serializable view that the dialog can render. Second, a
 * small state machine (ReviewState, initialReviewState, canSend)
 * decides when the user is allowed to send.
 *
 * Everything here is pure. No Office, no DOM, no time. That is
 * why it is easy to test, and the tests are where the value is.
 */

import type { Config } from "../config"
import { detectForgottenAttachment, realAttachments } from "./attachments"
import { isExternal } from "./recipients"
import { isSubjectEmpty } from "./body"
import { bodyPreview } from "./body"
import type { Attachment, FieldRecipient, MessageSnapshot, RecipientField } from "./types"

/** The longest body preview we show in the dialog. */
export const BODY_PREVIEW_MAX_LENGTH = 600

/** A recipient as shown in the dialog. */
export interface RecipientView {
  readonly field: RecipientField
  readonly displayName: string
  readonly emailAddress: string
  readonly isExternal: boolean
}

/** An attachment as shown in the dialog. */
export interface AttachmentView {
  readonly name: string
  readonly sizeBytes: number | null
}

/** The kinds of warning we can raise. */
export type WarningKind = "emptySubject" | "forgottenAttachment" | "externalRecipients"

/** A single warning with an optional count. */
export interface Warning {
  readonly kind: WarningKind
  readonly count: number
}

/**
 * The full view passed to the dialog.
 *
 * This must stay JSON-serializable: only plain values, no
 * functions and no Set. It crosses the dialog boundary as JSON.
 */
export interface ReviewModel {
  readonly subject: string
  readonly bodyPreview: string
  readonly recipients: readonly RecipientView[]
  readonly attachments: readonly AttachmentView[]
  /** Unique external addresses, deduplicated across all fields. */
  readonly externalEmails: readonly string[]
  readonly warnings: readonly Warning[]
  readonly sendDelaySeconds: number
  readonly requireRecipientConfirmation: boolean
  readonly requireAttachmentConfirmation: boolean
  readonly requireBodyConfirmation: boolean
}

/** Map one recipient to its view form. */
function toRecipientView(
  recipient: FieldRecipient,
  internalDomains: readonly string[],
): RecipientView {
  return {
    field: recipient.field,
    displayName: recipient.displayName,
    emailAddress: recipient.emailAddress,
    isExternal: isExternal(recipient.emailAddress, internalDomains),
  }
}

/** Map one attachment to its view form. */
function toAttachmentView(attachment: Attachment): AttachmentView {
  return { name: attachment.name, sizeBytes: attachment.size }
}

/**
 * Build the review model from a snapshot and config.
 *
 * This is the single place that decides what the dialog shows
 * and which confirmations are required.
 */
export function buildReviewModel(snapshot: MessageSnapshot, config: Config): ReviewModel {
  const recipients = snapshot.recipients.map((recipient) =>
    toRecipientView(recipient, config.internalDomains),
  )

  const externalEmails = [
    ...new Set(
      recipients
        .filter((recipient) => recipient.isExternal)
        .map((recipient) => recipient.emailAddress),
    ),
  ]

  const attachments = realAttachments(snapshot.attachments).map(toAttachmentView)

  const warnings: Warning[] = []
  if (config.warnOnEmptySubject && isSubjectEmpty(snapshot)) {
    warnings.push({ kind: "emptySubject", count: 0 })
  }
  if (detectForgottenAttachment(snapshot, config.attachmentKeywords)) {
    warnings.push({ kind: "forgottenAttachment", count: 0 })
  }
  if (externalEmails.length > 0) {
    warnings.push({ kind: "externalRecipients", count: externalEmails.length })
  }

  const sendDelaySeconds = Math.max(0, Math.floor(config.sendDelaySeconds))

  // A confirmation is required only when it is both turned on and
  // there is something to confirm. No recipients means no recipient
  // confirmation, no attachments means no attachment confirmation.
  const requireRecipientConfirmation = config.requireRecipientConfirmation && recipients.length > 0
  const requireAttachmentConfirmation =
    config.requireAttachmentConfirmation && attachments.length > 0
  const requireBodyConfirmation = config.requireBodyConfirmation

  return {
    subject: snapshot.subject,
    bodyPreview: bodyPreview(snapshot.body, BODY_PREVIEW_MAX_LENGTH),
    recipients,
    attachments,
    externalEmails,
    warnings,
    sendDelaySeconds,
    requireRecipientConfirmation,
    requireAttachmentConfirmation,
    requireBodyConfirmation,
  }
}

/**
 * The live state of the dialog.
 *
 * It tracks which boxes the user has checked. The send delay is not
 * part of this gate: it runs as a cancellable countdown after the
 * user presses Send, not before.
 */
export interface ReviewState {
  /** Indices of recipients the user has confirmed one by one. */
  readonly confirmedRecipients: ReadonlySet<number>
  /** Indices of attachments the user has confirmed one by one. */
  readonly confirmedAttachments: ReadonlySet<number>
  readonly bodyConfirmed: boolean
}

/**
 * Build the starting state for a model.
 *
 * If a confirmation is not required, it starts satisfied.
 */
export function initialReviewState(model: ReviewModel): ReviewState {
  return {
    confirmedRecipients: new Set<number>(),
    confirmedAttachments: new Set<number>(),
    bodyConfirmed: !model.requireBodyConfirmation,
  }
}

/** True when every index from 0 to count-1 is present in the set. */
function allIndicesConfirmed(count: number, confirmed: ReadonlySet<number>): boolean {
  for (let index = 0; index < count; index += 1) {
    if (!confirmed.has(index)) {
      return false
    }
  }
  return true
}

/**
 * Decide if the user may send now.
 *
 * Every required confirmation must be satisfied. When recipient or
 * attachment confirmation is required, every recipient and every
 * attachment must be checked one by one. The send delay is not part
 * of this gate; it runs after Send is pressed.
 */
export function canSend(model: ReviewModel, state: ReviewState): boolean {
  if (model.requireBodyConfirmation && !state.bodyConfirmed) {
    return false
  }
  if (
    model.requireRecipientConfirmation &&
    !allIndicesConfirmed(model.recipients.length, state.confirmedRecipients)
  ) {
    return false
  }
  if (
    model.requireAttachmentConfirmation &&
    !allIndicesConfirmed(model.attachments.length, state.confirmedAttachments)
  ) {
    return false
  }
  return true
}
