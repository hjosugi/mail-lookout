import { describe, expect, it } from "vitest"

import { defaultConfig } from "../src/config/defaults"
import { buildReviewModel, initialReviewState } from "../src/domain/review"
import type { ReviewState } from "../src/domain/review"
import type { MessageSnapshot } from "../src/domain/types"
import { clearProgress, loadProgress, saveProgress } from "../src/office/reviewProgress"
import type { StorageLike } from "../src/office/reviewProgress"

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
    saveProgress("fp1", { state: progressState(), deadline: 1234 }, storage)

    const loaded = loadProgress(model, "fp1", storage)
    expect(loaded?.deadline).toBe(1234)
    expect([...(loaded?.state.confirmedRecipients ?? [])].sort()).toEqual([0, 1])
    expect([...(loaded?.state.confirmedAttachments ?? [])]).toEqual([0])
    expect(loaded?.state.bodyConfirmed).toBe(true)
  })

  it("ignores progress saved under a different fingerprint", () => {
    const storage = new MemoryStorage()
    saveProgress("old", { state: progressState(), deadline: null }, storage)
    expect(loadProgress(model, "new", storage)).toBeNull()
  })

  it("returns null when nothing is stored", () => {
    expect(loadProgress(model, "fp1", new MemoryStorage())).toBeNull()
  })

  it("clears stored progress", () => {
    const storage = new MemoryStorage()
    saveProgress("fp1", { state: progressState(), deadline: 1 }, storage)
    clearProgress(storage)
    expect(loadProgress(model, "fp1", storage)).toBeNull()
  })

  it("drops malformed indices from untrusted storage", () => {
    const storage = new MemoryStorage()
    storage.setItem(
      "mail-lookout:review-progress",
      JSON.stringify({
        fingerprint: "fp1",
        recipients: [0, "x", -1, 1.5, 2],
        attachments: "nope",
        subject: true,
        body: false,
        deadline: null,
      }),
    )
    const loaded = loadProgress(model, "fp1", storage)
    expect([...(loaded?.state.confirmedRecipients ?? [])]).toEqual([0, 2])
    expect([...(loaded?.state.confirmedAttachments ?? [])]).toEqual([])
  })
})
