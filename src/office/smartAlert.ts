/// <reference types="office-js" />

import type { ReviewModel } from "../domain/review"
import type { MessageSnapshot } from "../domain/types"
import { getMessages } from "../i18n/catalog"
import type { LocaleTag, Messages } from "../i18n"

const CONFIRMATION_STORAGE_KEY = "mail-lookout:send-confirmations"
const CONFIRMATION_TTL_MS = 10 * 60 * 1000
const MAX_ALERT_MESSAGE_LENGTH = 500
export const REVIEW_PANE_COMMAND_ID = "ReviewPaneButton"

/**
 * Confirmations are a map of fingerprint -> expiry, so several messages
 * can be confirmed and sent independently without one clobbering another.
 * The in-memory copy only covers the case where localStorage throws (a
 * reused event runtime); when storage works it is the source of truth.
 */
type Confirmations = Record<string, number>

let memoryConfirmations: Confirmations = {}

function parseConfirmations(raw: string): Confirmations {
  const map: Confirmations = {}
  const parsed = JSON.parse(raw) as Record<string, unknown>
  if (typeof parsed === "object" && parsed !== null) {
    for (const [fingerprint, expiresAt] of Object.entries(parsed)) {
      if (typeof expiresAt === "number") {
        map[fingerprint] = expiresAt
      }
    }
  }
  return map
}

function pruneExpired(map: Confirmations, now: number): Confirmations {
  for (const fingerprint of Object.keys(map)) {
    const expiresAt = map[fingerprint]
    if (expiresAt === undefined || expiresAt < now) {
      delete map[fingerprint]
    }
  }
  return map
}

function readConfirmations(storage: StorageLike, now: number): Confirmations {
  let map: Confirmations
  try {
    const raw = storage.getItem(CONFIRMATION_STORAGE_KEY)
    map = raw ? parseConfirmations(raw) : {}
  } catch {
    // Storage unavailable: fall back to the in-memory copy.
    map = { ...memoryConfirmations }
  }
  return pruneExpired(map, now)
}

function writeConfirmations(storage: StorageLike, map: Confirmations): void {
  memoryConfirmations = map
  try {
    if (Object.keys(map).length === 0) {
      storage.removeItem(CONFIRMATION_STORAGE_KEY)
    } else {
      storage.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(map))
    }
  } catch {
    // The in-memory fallback still covers a reused event runtime.
  }
}

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
  const map = readConfirmations(storage, now)
  map[fingerprint] = now + CONFIRMATION_TTL_MS
  writeConfirmations(storage, map)
}

export function consumeConfirmation(
  fingerprint: string,
  storage: StorageLike = window.localStorage,
  now = Date.now(),
): boolean {
  const map = readConfirmations(storage, now)
  const expiresAt = map[fingerprint]
  const valid = typeof expiresAt === "number" && expiresAt >= now
  if (fingerprint in map) {
    delete map[fingerprint]
    writeConfirmations(storage, map)
  }
  return valid
}

export function smartAlertCancelOptions(
  locale: LocaleTag,
  waiting: boolean,
): Office.SmartAlertsEventCompletedOptions {
  const messages = getMessages(locale)
  return {
    allowEvent: false,
    errorMessage: buildSmartAlertMessage(messages, false, waiting),
    errorMessageMarkdown: buildSmartAlertMessage(messages, true, waiting),
    cancelLabel: waiting ? messages.smartAlert.showWaiting : messages.smartAlert.openReview,
    commandId: REVIEW_PANE_COMMAND_ID,
  }
}

export function buildSmartAlertMessage(
  messages: Messages,
  markdown: boolean,
  waiting: boolean,
): string {
  // Keep the built-in alert to two lines: the title and one prompt. The
  // prompt line must stay — a title-only message makes Outlook drop the
  // action button, leaving only "Don't send". Warnings and detail live in
  // the review pane, not here.
  const body = waiting ? messages.smartAlert.waiting : messages.smartAlert.prompt
  const title = markdown ? strong(messages.dialog.title) : messages.dialog.title
  const lines = [title, body]

  const escaped = markdown ? lines.map(escapeMarkdown) : lines
  if (markdown) {
    escaped[0] = title
  }
  return truncate(escaped.join("\n\n"), MAX_ALERT_MESSAGE_LENGTH)
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
