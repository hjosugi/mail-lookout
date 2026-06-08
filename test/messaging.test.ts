import { describe, expect, it } from "vitest";

import { decode, encode } from "../src/shared/messaging";
import type { DialogToParent, ParentToDialog } from "../src/shared/messaging";
import type { ReviewModel } from "../src/domain/review";

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
};

describe("encode and decode", () => {
  it("round-trips an init message from parent to dialog", () => {
    const message: ParentToDialog = { type: "init", model, locale: "ja" };
    const raw = encode(message);
    const back = decode<ParentToDialog>(raw);
    // The decoded value must equal the original. This proves the
    // model survives the JSON boundary with no loss.
    expect(back).toEqual(message);
  });

  it("round-trips a ready message from dialog to parent", () => {
    const message: DialogToParent = { type: "ready" };
    expect(decode<DialogToParent>(encode(message))).toEqual(message);
  });

  it("round-trips a decision message with allow true", () => {
    const message: DialogToParent = { type: "decision", allow: true };
    expect(decode<DialogToParent>(encode(message))).toEqual(message);
  });

  it("round-trips a decision message with allow false", () => {
    const message: DialogToParent = { type: "decision", allow: false };
    expect(decode<DialogToParent>(encode(message))).toEqual(message);
  });
});

describe("decode on bad input", () => {
  it("returns null for a string that is not JSON", () => {
    expect(decode("not json")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(decode("")).toBeNull();
  });

  it("returns null for a truncated JSON string", () => {
    expect(decode('{"type":"rea')).toBeNull();
  });
});
