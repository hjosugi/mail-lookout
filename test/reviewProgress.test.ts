import { describe, expect, it } from "vitest"

import { defaultConfig } from "@/config/defaults"
import { buildReviewModel, initialReviewState } from "@/domain/review"
import type { ReviewState } from "@/domain/review"
import type { MessageSnapshot } from "@/domain/types"
import {
  MAX_PENDING_REVIEWS,
  clearProgress,
  countWaiting,
  listWaiting,
  loadProgress,
  saveProgress,
} from "@/office/reviewProgress"
import type { StorageLike, WaitingDisplay } from "@/office/reviewProgress"

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const snapshot: MessageSnapshot = {
  subject: "Quarterly review",
  body: "Body",
  senderEmail: "me@example.com",
  recipients: [
    { field: "to", displayName: "Aki", emailAddress: "aki@example.com" },
    { field: "cc", displayName: "Jordan", emailAddress: "jordan@partner.test" },
  ],
  attachments: [{ id: "1", name: "a.pdf", size: 10, isInline: false }],
}

const model = buildReviewModel(snapshot, defaultConfig)
const display: WaitingDisplay = { subject: "Quarterly review", recipientCount: 2 }

function progressState(): ReviewState {
  return {
    ...initialReviewState(model),
    confirmedRecipients: new Set([0, 1]),
    confirmedAttachments: new Set([0]),
    bodyConfirmed: true,
  }
}

describe("review progress persistence", () => {
  it("round-trips the checked state and the countdown deadline", () => {
    const storage = new MemoryStorage()
    saveProgress("fp1", { state: progressState(), deadline: 1234 }, display, storage)

    const loaded = loadProgress(model, "fp1", storage)
    expect(loaded?.deadline).toBe(1234)
    expect([...(loaded?.state.confirmedRecipients ?? [])].sort()).toEqual([0, 1])
    expect([...(loaded?.state.confirmedAttachments ?? [])]).toEqual([0])
    expect(loaded?.state.bodyConfirmed).toBe(true)
  })

  it("keeps a separate slot per message, so one does not clobber another", () => {
    const storage = new MemoryStorage()
    saveProgress("a", { state: progressState(), deadline: 1 }, display, storage)
    saveProgress("b", { state: initialReviewState(model), deadline: 2 }, display, storage)

    expect(loadProgress(model, "a", storage)?.deadline).toBe(1)
    expect([...(loadProgress(model, "a", storage)?.state.confirmedRecipients ?? [])]).toEqual([0, 1])
    expect(loadProgress(model, "b", storage)?.deadline).toBe(2)
  })

  it("ignores progress saved under a different fingerprint", () => {
    const storage = new MemoryStorage()
    saveProgress("old", { state: progressState(), deadline: null }, display, storage)
    expect(loadProgress(model, "new", storage)).toBeNull()
  })

  it("returns null when nothing is stored", () => {
    expect(loadProgress(model, "fp1", new MemoryStorage())).toBeNull()
  })

  it("clears only the given message's slot", () => {
    const storage = new MemoryStorage()
    saveProgress("fp1", { state: progressState(), deadline: 1 }, display, storage)
    saveProgress("fp2", { state: progressState(), deadline: 2 }, display, storage)
    clearProgress("fp1", storage)
    expect(loadProgress(model, "fp1", storage)).toBeNull()
    expect(loadProgress(model, "fp2", storage)?.deadline).toBe(2)
  })

  it("drops entries untouched past the time-to-live", () => {
    const storage = new MemoryStorage()
    saveProgress("fp1", { state: progressState(), deadline: 1 }, display, storage, 1000)
    // A day and a bit later, the abandoned entry is gone.
    const muchLater = 1000 + 25 * 60 * 60 * 1000
    expect(loadProgress(model, "fp1", storage, muchLater)).toBeNull()
  })

  it("drops malformed indices from untrusted storage", () => {
    const storage = new MemoryStorage()
    storage.setItem(
      "mail-lookout:pending-reviews",
      JSON.stringify({
        fp1: {
          fingerprint: "fp1",
          recipients: [0, "x", -1, 1.5, 2],
          attachments: "nope",
          subject: "Quarterly review",
          recipientCount: 2,
          subjectConfirmed: false,
          bodyConfirmed: false,
          deadline: null,
          updatedAt: 1000,
        },
      }),
    )
    const loaded = loadProgress(model, "fp1", storage, 1000)
    expect([...(loaded?.state.confirmedRecipients ?? [])]).toEqual([0, 2])
    expect([...(loaded?.state.confirmedAttachments ?? [])]).toEqual([])
  })
})

describe("waiting list", () => {
  it("lists only the messages counting down, soonest first, with display info", () => {
    const storage = new MemoryStorage()
    saveProgress(
      "a",
      { state: progressState(), deadline: 5000 },
      { subject: "A", recipientCount: 3 },
      storage,
      1000,
    )
    saveProgress(
      "b",
      { state: progressState(), deadline: 3000 },
      { subject: "B", recipientCount: 1 },
      storage,
      1000,
    )
    // No deadline: in review, not waiting.
    saveProgress(
      "c",
      { state: progressState(), deadline: null },
      { subject: "C", recipientCount: 9 },
      storage,
      1000,
    )

    const waiting = listWaiting(1000, storage)
    expect(waiting.map(item => item.fingerprint)).toEqual(["b", "a"])
    expect(waiting[0]).toMatchObject({ subject: "B", recipientCount: 1, deadline: 3000 })
    expect(countWaiting(1000, storage)).toBe(2)
  })

  it("can fill every slot up to the cap", () => {
    const storage = new MemoryStorage()
    for (let index = 0; index < MAX_PENDING_REVIEWS; index += 1) {
      saveProgress(
        `fp${index}`,
        { state: progressState(), deadline: 2000 + index },
        display,
        storage,
        1000,
      )
    }
    expect(countWaiting(1000, storage)).toBe(MAX_PENDING_REVIEWS)
  })
})
