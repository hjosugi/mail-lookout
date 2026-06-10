import { describe, expect, it } from "vitest"

import {
  MessageType,
  decodeDialogToParent,
  decodeParentToDialog,
  encode,
} from "../src/shared/messaging"
import type { DialogToParent, ParentToDialog } from "../src/shared/messaging"
import type { ReviewModel } from "../src/domain/review"

// A realistic model: several recipients across To/Cc, a mix of
// internal and external, and more than one attachment. Single-address
// fixtures would miss the cases this add-in exists to catch.
const model: ReviewModel = {
  subject: "Hello",
  bodyPreview: "Body text",
  recipients: [
    { field: "to", displayName: "Ann", emailAddress: "ann@other.com", isExternal: true },
    { field: "to", displayName: "Ben", emailAddress: "ben@example.com", isExternal: false },
    { field: "cc", displayName: "Cara", emailAddress: "cara@partner.test", isExternal: true },
  ],
  attachments: [
    { name: "report.pdf", sizeBytes: 1024 },
    { name: "data.csv", sizeBytes: 2048 },
  ],
  externalEmails: ["ann@other.com", "cara@partner.test"],
  warnings: [{ kind: "externalRecipients", count: 2 }],
  sendDelaySeconds: 5,
  requireRecipientConfirmation: true,
  requireAttachmentConfirmation: true,
  requireBodyConfirmation: true,
}

describe("encode and decode round-trips", () => {
  it("round-trips an init message from parent to dialog", () => {
    const message: ParentToDialog = { type: MessageType.Init, model, locale: "ja" }
    const back = decodeParentToDialog(encode(message))
    // The decoded value must equal the original. This proves the
    // model survives the JSON boundary with no loss.
    expect(back).toEqual(message)
  })

  it("round-trips a ready message from dialog to parent", () => {
    const message: DialogToParent = { type: MessageType.Ready }
    expect(decodeDialogToParent(encode(message))).toEqual(message)
  })

  it("round-trips a decision message with allow true", () => {
    const message: DialogToParent = { type: MessageType.Decision, allow: true }
    expect(decodeDialogToParent(encode(message))).toEqual(message)
  })

  it("round-trips a decision message with allow false", () => {
    const message: DialogToParent = { type: MessageType.Decision, allow: false }
    expect(decodeDialogToParent(encode(message))).toEqual(message)
  })
})

describe("decode rejects malformed input", () => {
  it("returns null for a string that is not JSON", () => {
    expect(decodeParentToDialog("not json")).toBeNull()
    expect(decodeDialogToParent("not json")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(decodeDialogToParent("")).toBeNull()
  })

  it("returns null for a truncated JSON string", () => {
    expect(decodeDialogToParent('{"type":"rea')).toBeNull()
  })
})

describe("decode rejects schema violations", () => {
  it("rejects an init message with an unknown locale", () => {
    const raw = JSON.stringify({ type: MessageType.Init, model, locale: "xx" })
    expect(decodeParentToDialog(raw)).toBeNull()
  })

  it("rejects an init message missing a model field", () => {
    const incomplete = JSON.parse(JSON.stringify(model)) as Record<string, unknown>
    delete incomplete.subject
    const raw = JSON.stringify({ type: MessageType.Init, model: incomplete, locale: "ja" })
    expect(decodeParentToDialog(raw)).toBeNull()
  })

  it("rejects an init message with a wrong-typed model field", () => {
    const raw = JSON.stringify({
      type: MessageType.Init,
      model: { ...model, sendDelaySeconds: "5" },
      locale: "ja",
    })
    expect(decodeParentToDialog(raw)).toBeNull()
  })

  it("rejects a recipient whose field is not to/cc/bcc", () => {
    const badModel = {
      ...model,
      recipients: [
        { field: "reply-to", displayName: "X", emailAddress: "x@other.com", isExternal: true },
      ],
    }
    const raw = JSON.stringify({ type: MessageType.Init, model: badModel, locale: "ja" })
    expect(decodeParentToDialog(raw)).toBeNull()
  })

  it("rejects a dialog message with an unknown type", () => {
    expect(decodeDialogToParent(JSON.stringify({ type: "bogus" }))).toBeNull()
  })

  it("rejects a decision message missing allow", () => {
    expect(decodeDialogToParent(JSON.stringify({ type: MessageType.Decision }))).toBeNull()
  })

  it("rejects a decision message with a non-boolean allow", () => {
    expect(
      decodeDialogToParent(JSON.stringify({ type: MessageType.Decision, allow: "yes" })),
    ).toBeNull()
  })

  it("rejects a message handed to the wrong decoder", () => {
    // A ready message is not a valid parent-to-dialog message, and an
    // init message is not a valid dialog-to-parent message.
    expect(decodeParentToDialog(encode({ type: MessageType.Ready }))).toBeNull()
    const init: ParentToDialog = { type: MessageType.Init, model, locale: "en" }
    expect(decodeDialogToParent(encode(init))).toBeNull()
  })
})
