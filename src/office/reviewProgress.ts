/// <reference types="office-js" />

/**
 * Persist a task pane review in progress.
 *
 * Closing the task pane tears down its runtime, so the checkboxes the
 * user ticked and the running countdown would be lost on reopen. We keep
 * them in storage, keyed by the message fingerprint, so reopening the
 * same unchanged draft resumes exactly where it was left. Only an
 * explicit cancel clears it.
 *
 * The countdown is stored as a wall-clock deadline, so time keeps running
 * while the pane is closed: reopening after it passed is already done.
 */

import { initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"

const PROGRESS_STORAGE_KEY = "mail-lookout:review-progress"

export interface ReviewProgress {
  readonly state: ReviewState
  /** Epoch ms when the post-confirm countdown ends, or null if it has not started. */
  readonly deadline: number | null
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface StoredProgress {
  readonly fingerprint: string
  readonly recipients: number[]
  readonly attachments: number[]
  readonly subject: boolean
  readonly body: boolean
  readonly deadline: number | null
}

export function saveProgress(
  fingerprint: string,
  progress: ReviewProgress,
  storage: StorageLike = window.localStorage,
): void {
  const stored: StoredProgress = {
    fingerprint,
    recipients: [...progress.state.confirmedRecipients],
    attachments: [...progress.state.confirmedAttachments],
    subject: progress.state.subjectConfirmed,
    body: progress.state.bodyConfirmed,
    deadline: progress.deadline,
  }
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // No persistence available; the live review still works for this open.
  }
}

/**
 * Load saved progress for this message, or null.
 *
 * Null covers every "start fresh" case: nothing stored, unreadable or
 * invalid JSON, or a fingerprint that does not match (the draft changed,
 * so the old checks no longer apply).
 */
export function loadProgress(
  model: ReviewModel,
  fingerprint: string,
  storage: StorageLike = window.localStorage,
): ReviewProgress | null {
  let raw: string | null
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) {
    return null
  }

  let parsed: Partial<StoredProgress>
  try {
    parsed = JSON.parse(raw) as Partial<StoredProgress>
  } catch {
    return null
  }
  if (parsed.fingerprint !== fingerprint) {
    return null
  }

  const base = initialReviewState(model)
  return {
    state: {
      confirmedRecipients: new Set(asIndices(parsed.recipients)),
      confirmedAttachments: new Set(asIndices(parsed.attachments)),
      subjectConfirmed: parsed.subject === true || base.subjectConfirmed,
      bodyConfirmed: parsed.body === true || base.bodyConfirmed,
    },
    deadline: typeof parsed.deadline === "number" ? parsed.deadline : null,
  }
}

export function clearProgress(storage: StorageLike = window.localStorage): void {
  try {
    storage.removeItem(PROGRESS_STORAGE_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
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
