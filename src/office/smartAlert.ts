/// <reference types="office-js" />

import type { ReviewModel } from "../domain/review"
import type { MessageSnapshot } from "../domain/types"
import { getMessages } from "../i18n/catalog"
import type { LocaleTag, Messages } from "../i18n"

const CONFIRMATION_STORAGE_KEY = "mail-lookout:send-confirmation"
const CONFIRMATION_TTL_MS = 10 * 60 * 1000
const MAX_ALERT_MESSAGE_LENGTH = 500
const LIST_PREVIEW_COUNT = 3
export const REVIEW_PANE_COMMAND_ID = "ReviewPaneButton"

interface StoredConfirmation {
  readonly fingerprint: string
  readonly expiresAt: number
}

let memoryConfirmation: StoredConfirmation | null = null

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function needsSmartAlertConfirmation(model: ReviewModel): boolean {
  return (
    model.requireSubjectConfirmation ||
    model.requireRecipientConfirmation ||
    model.requireAttachmentConfirmation ||
    model.requireBodyConfirmation ||
    model.warnings.length > 0
  )
}

export function snapshotFingerprint(snapshot: MessageSnapshot): string {
  const raw = JSON.stringify({
    subject: snapshot.subject,
    body: snapshot.body,
    senderEmail: snapshot.senderEmail,
    recipients: snapshot.recipients,
    attachments: snapshot.attachments,
  })
  return `v1:${hashString(raw)}`
}

export function rememberConfirmation(
  fingerprint: string,
  storage: StorageLike = window.localStorage,
  now = Date.now(),
): void {
  const confirmation: StoredConfirmation = {
    fingerprint,
    expiresAt: now + CONFIRMATION_TTL_MS,
  }
  memoryConfirmation = confirmation
  try {
    storage.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(confirmation))
  } catch {
    // The in-memory fallback still covers a reused event runtime.
  }
}

export function consumeConfirmation(
  fingerprint: string,
  storage: StorageLike = window.localStorage,
  now = Date.now(),
): boolean {
  let confirmation: Partial<StoredConfirmation> | null = memoryConfirmation
  memoryConfirmation = null

  try {
    const raw = storage.getItem(CONFIRMATION_STORAGE_KEY)
    storage.removeItem(CONFIRMATION_STORAGE_KEY)
    if (raw) {
      confirmation = JSON.parse(raw) as Partial<StoredConfirmation>
    }
  } catch {
    // Fall through to the in-memory fallback.
  }

  return confirmation?.fingerprint === fingerprint && Number(confirmation.expiresAt) >= now
}

export function smartAlertCancelOptions(
  model: ReviewModel,
  locale: LocaleTag,
): Office.SmartAlertsEventCompletedOptions {
  const messages = getMessages(locale)
  return {
    allowEvent: false,
    errorMessage: buildSmartAlertMessage(model, messages, false),
    errorMessageMarkdown: buildSmartAlertMessage(model, messages, true),
    cancelLabel: messages.smartAlert.openReview,
    commandId: REVIEW_PANE_COMMAND_ID,
  }
}

export function buildSmartAlertMessage(
  model: ReviewModel,
  messages: Messages,
  markdown: boolean,
): string {
  const subject = model.subject.trim() || messages.subject.empty
  const warnings = model.warnings.map(warning => warningText(warning, messages))
  const recipients = summarize(
    model.recipients.map(recipient => {
      const name = recipient.displayName
        ? `${recipient.displayName} <${recipient.emailAddress}>`
        : recipient.emailAddress
      const external = recipient.isExternal ? ` ${messages.recipients.externalBadge}` : ""
      return `${messages.fields[recipient.field]}: ${name}${external}`
    }),
    messages,
    messages.recipients.none,
  )
  const attachments = summarize(
    model.attachments.map(attachment => attachment.name),
    messages,
    messages.attachments.none,
  )
  const body = model.bodyPreview.trim() || messages.body.empty

  const title = markdown ? strong(messages.dialog.title) : messages.dialog.title
  const lines = [
    title,
    messages.smartAlert.sendAgain,
    warnings.length > 0 ? `${messages.smartAlert.warnings}: ${warnings.join(" / ")}` : "",
    `${messages.sections.recipients}: ${recipients}`,
    `${messages.sections.attachments}: ${attachments}`,
    `${messages.sections.subject}: ${subject}`,
    `${messages.sections.body}: ${body}`,
  ].filter(line => line.length > 0)

  const escaped = markdown ? lines.map(escapeMarkdown) : lines
  if (markdown) {
    escaped[0] = title
  }
  return truncate(escaped.join("\n\n"), MAX_ALERT_MESSAGE_LENGTH)
}

function summarize(items: readonly string[], messages: Messages, empty: string): string {
  if (items.length === 0) {
    return empty
  }
  const shown = items.slice(0, LIST_PREVIEW_COUNT)
  const remaining = items.length - shown.length
  return remaining > 0
    ? `${shown.join(", ")} (${messages.smartAlert.moreItems(remaining)})`
    : shown.join(", ")
}

function warningText(warning: ReviewModel["warnings"][number], messages: Messages): string {
  switch (warning.kind) {
    case "emptySubject":
      return messages.warnings.emptySubject
    case "forgottenAttachment":
      return messages.warnings.forgottenAttachment
    case "externalRecipients":
      return messages.warnings.externalRecipients(warning.count)
  }
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function strong(value: string): string {
  return `**${escapeMarkdown(value)}**`
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\*_[\]()])/g, "\\$1")
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}
