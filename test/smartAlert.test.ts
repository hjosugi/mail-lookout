import { describe, expect, it } from "vitest"

import { defaultConfig } from "../src/config/defaults"
import { buildReviewModel } from "../src/domain/review"
import type { MessageSnapshot } from "../src/domain/types"
import { locales } from "../src/i18n/catalog"
import {
  REVIEW_PANE_COMMAND_ID,
  buildSmartAlertMessage,
  consumeConfirmation,
  needsSmartAlertConfirmation,
  rememberConfirmation,
  smartAlertCancelOptions,
  snapshotFingerprint,
} from "../src/office/smartAlert"
import type { StorageLike } from "../src/office/smartAlert"

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

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error("storage unavailable")
  }

  setItem(): void {
    throw new Error("storage unavailable")
  }

  removeItem(): void {
    throw new Error("storage unavailable")
  }
}

function snapshot(overrides: Partial<MessageSnapshot> = {}): MessageSnapshot {
  return {
    subject: "",
    body: "Please review the attached report before sending.",
    senderEmail: "me@example.com",
    recipients: [
      { field: "to", displayName: "Ann", emailAddress: "ann@other.com" },
      { field: "cc", displayName: "Ben", emailAddress: "ben@example.com" },
    ],
    attachments: [{ id: "1", name: "report.pdf", size: 1234, isInline: false }],
    ...overrides,
  }
}

describe("Smart Alerts confirmation", () => {
  it("stores a same-message confirmation for one later send attempt", () => {
    const storage = new MemoryStorage()
    const fingerprint = snapshotFingerprint(snapshot())

    expect(consumeConfirmation(fingerprint, storage, 1000)).toBe(false)
    rememberConfirmation(fingerprint, storage, 1000)
    expect(consumeConfirmation(fingerprint, storage, 1001)).toBe(true)
    expect(consumeConfirmation(fingerprint, storage, 1002)).toBe(false)
  })

  it("does not consume confirmation after the draft changes", () => {
    const storage = new MemoryStorage()
    const first = snapshotFingerprint(snapshot())
    const changed = snapshotFingerprint(snapshot({ body: "Changed body" }))

    rememberConfirmation(first, storage, 1000)
    expect(consumeConfirmation(changed, storage, 1001)).toBe(false)
  })

  it("expires old confirmations", () => {
    const storage = new MemoryStorage()
    const fingerprint = snapshotFingerprint(snapshot())

    rememberConfirmation(fingerprint, storage, 1000)
    expect(consumeConfirmation(fingerprint, storage, 1000 + 10 * 60 * 1000 + 1)).toBe(false)
  })

  it("falls back to memory when storage is unavailable", () => {
    const storage = new ThrowingStorage()
    const fingerprint = snapshotFingerprint(snapshot())

    rememberConfirmation(fingerprint, storage, 1000)
    expect(consumeConfirmation(fingerprint, storage, 1001)).toBe(true)
  })
})

describe("Smart Alerts message", () => {
  it("uses the built-in dialog limit and asks the user to send again", () => {
    const model = buildReviewModel(snapshot(), defaultConfig)
    const message = buildSmartAlertMessage(model, locales.ja, true)

    expect(message.length).toBeLessThanOrEqual(500)
    expect(message).toContain("もう一度送信")
    // The alert stays short: message body detail lives in the review pane,
    // so it must not dump the subject or body into the built-in dialog.
    expect(message).not.toContain("本文:")
  })

  it("creates completed options with plaintext and markdown messages", () => {
    const model = buildReviewModel(snapshot(), defaultConfig)
    const options = smartAlertCancelOptions(model, "en")

    expect(options.allowEvent).toBe(false)
    expect(options.errorMessage).toContain("press Send again")
    expect(options.errorMessageMarkdown).toContain("**Confirm before sending**")
    expect(options.cancelLabel).toBe("Open review")
    expect(options.commandId).toBe(REVIEW_PANE_COMMAND_ID)
  })

  it("does not require confirmation when every gate is disabled and there are no warnings", () => {
    const model = buildReviewModel(
      snapshot({ subject: "Hello", body: "Plain body", attachments: [], recipients: [] }),
      {
        ...defaultConfig,
        requireBodyConfirmation: false,
        requireRecipientConfirmation: false,
        requireAttachmentConfirmation: false,
        warnOnEmptySubject: false,
      },
    )

    expect(needsSmartAlertConfirmation(model)).toBe(false)
  })
})
