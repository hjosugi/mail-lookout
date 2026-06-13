/// <reference types="office-js" />

/**
 * Persist task pane reviews in progress — one slot per message.
 *
 * Closing the task pane tears down its runtime, so the checkboxes the
 * user ticked and the running countdown would be lost on reopen. We keep
 * them in storage, keyed by message fingerprint, so reopening the same
 * unchanged draft resumes exactly where it was left. Only an explicit
 * cancel (or sending) clears a slot.
 *
 * Several messages can be in flight at once — each compose window has its
 * own pane — so the store is a map of fingerprint -> entry rather than a
 * single slot. The entries that are counting down form the "waiting" set,
 * which drives the status banner and the send-wait cap.
 *
 * The countdown is stored as a wall-clock deadline, so time keeps running
 * while the pane is closed: reopening after it passed is already done.
 */

import { initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"

const PROGRESS_STORAGE_KEY = "mail-lookout:pending-reviews"

/** The most messages that may wait to send at the same time. */
export const MAX_PENDING_REVIEWS = 10

/** Drop entries untouched for this long, so abandoned reviews don't pile up. */
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Keep showing a waiting entry for a few seconds after its deadline, so a
 * finished countdown reads "0s" briefly instead of vanishing mid-blink.
 * Past this, the entry is dropped regardless of whether the send happened.
 */
const SEND_GRACE_MS = 5000

export interface ReviewProgress {
  readonly state: ReviewState
  /** Epoch ms when the post-confirm countdown ends, or null if it has not started. */
  readonly deadline: number | null
}

/** The bit of display info the status list needs about a waiting send. */
export interface WaitingDisplay {
  readonly subject: string
  readonly recipientCount: number
}

/** One waiting send, as shown in the status list. */
export interface WaitingReview {
  readonly fingerprint: string
  readonly subject: string
  readonly recipientCount: number
  /** Epoch ms when this send fires. */
  readonly deadline: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface StoredEntry {
  readonly fingerprint: string
  readonly subject: string
  readonly recipientCount: number
  readonly recipients: number[]
  readonly attachments: number[]
  readonly subjectConfirmed: boolean
  readonly bodyConfirmed: boolean
  readonly deadline: number | null
  readonly updatedAt: number
}

type Registry = Record<string, StoredEntry>

function readRegistry(storage: StorageLike, now: number): Registry {
  let raw: string | null
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY)
  } catch {
    return {}
  }
  if (!raw) {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== "object" || parsed === null) {
    return {}
  }

  const registry: Registry = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const entry = asEntry(key, value, now)
    if (entry) {
      registry[key] = entry
    }
  }
  return registry
}

function writeRegistry(storage: StorageLike, registry: Registry): void {
  try {
    if (Object.keys(registry).length === 0) {
      storage.removeItem(PROGRESS_STORAGE_KEY)
    } else {
      storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(registry))
    }
  } catch {
    // No persistence available; the live review still works for this open.
  }
}

/** Validate one stored entry, dropping it if stale or malformed. */
function asEntry(key: string, value: unknown, now: number): StoredEntry | null {
  if (typeof value !== "object" || value === null) {
    return null
  }
  const entry = value as Partial<StoredEntry>
  if (entry.fingerprint !== key) {
    return null
  }
  const updatedAt = typeof entry.updatedAt === "number" ? entry.updatedAt : 0
  if (now - updatedAt > ENTRY_TTL_MS) {
    return null
  }
  return {
    fingerprint: key,
    subject: typeof entry.subject === "string" ? entry.subject : "",
    recipientCount:
      typeof entry.recipientCount === "number" && entry.recipientCount >= 0
        ? Math.floor(entry.recipientCount)
        : 0,
    recipients: asIndices(entry.recipients),
    attachments: asIndices(entry.attachments),
    subjectConfirmed: entry.subjectConfirmed === true,
    bodyConfirmed: entry.bodyConfirmed === true,
    deadline: typeof entry.deadline === "number" ? entry.deadline : null,
    updatedAt,
  }
}

export function saveProgress(
  fingerprint: string,
  progress: ReviewProgress,
  display: WaitingDisplay,
  storage: StorageLike = window.localStorage,
  now = Date.now(),
): void {
  const registry = readRegistry(storage, now)
  // Cleanup before adding: drop sends that finished (past deadline + grace),
  // so failed or abandoned ones can't pile up over time.
  for (const [key, entry] of Object.entries(registry)) {
    if (entry.deadline != null && entry.deadline + SEND_GRACE_MS <= now) {
      delete registry[key]
    }
  }
  registry[fingerprint] = {
    fingerprint,
    subject: display.subject,
    recipientCount: display.recipientCount,
    recipients: [...progress.state.confirmedRecipients],
    attachments: [...progress.state.confirmedAttachments],
    subjectConfirmed: progress.state.subjectConfirmed,
    bodyConfirmed: progress.state.bodyConfirmed,
    deadline: progress.deadline,
    updatedAt: now,
  }
  writeRegistry(storage, registry)
}

/**
 * Load saved progress for this message, or null.
 *
 * Null covers every "start fresh" case: nothing stored, unreadable or
 * invalid data, or no entry for this fingerprint (the draft changed, so
 * the old checks no longer apply).
 */
export function loadProgress(
  model: ReviewModel,
  fingerprint: string,
  storage: StorageLike = window.localStorage,
  now = Date.now(),
): ReviewProgress | null {
  const entry = readRegistry(storage, now)[fingerprint]
  if (!entry) {
    return null
  }
  const base = initialReviewState(model)
  return {
    state: {
      confirmedRecipients: new Set(entry.recipients),
      confirmedAttachments: new Set(entry.attachments),
      subjectConfirmed: entry.subjectConfirmed || base.subjectConfirmed,
      bodyConfirmed: entry.bodyConfirmed || base.bodyConfirmed,
    },
    deadline: entry.deadline,
  }
}

export function clearProgress(
  fingerprint: string,
  storage: StorageLike = window.localStorage,
  now = Date.now(),
): void {
  const registry = readRegistry(storage, now)
  if (fingerprint in registry) {
    delete registry[fingerprint]
    writeRegistry(storage, registry)
  }
}

/** True when a send countdown is currently running for this message. */
export function isCountdownActive(
  fingerprint: string,
  now = Date.now(),
  storage: StorageLike = window.localStorage,
): boolean {
  const entry = readRegistry(storage, now)[fingerprint]
  return entry?.deadline != null && entry.deadline > now
}

/**
 * Every message still counting down to send (plus a short grace), soonest
 * first.
 *
 * An entry is shown until SEND_GRACE_MS past its deadline, so a finished
 * countdown reads "0s" for a moment and then drops — regardless of whether
 * the send happened. After the grace it no longer lingers in the banner or
 * counts against the cap; the owning pane's own send runs off its live
 * timer, not this list, so excluding it here does not stop it.
 */
export function listWaiting(
  now = Date.now(),
  storage: StorageLike = window.localStorage,
): WaitingReview[] {
  return Object.values(readRegistry(storage, now))
    .filter(
      (entry): entry is StoredEntry & { deadline: number } =>
        entry.deadline != null && entry.deadline + SEND_GRACE_MS > now,
    )
    .map(entry => ({
      fingerprint: entry.fingerprint,
      subject: entry.subject,
      recipientCount: entry.recipientCount,
      deadline: entry.deadline,
    }))
    .sort((a, b) => a.deadline - b.deadline)
}

/** How many messages are waiting to send right now. */
export function countWaiting(now = Date.now(), storage: StorageLike = window.localStorage): number {
  return listWaiting(now, storage).length
}

/** Keep only finite non-negative integers from untrusted stored data. */
function asIndices(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 0,
  )
}
