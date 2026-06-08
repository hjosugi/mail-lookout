import { describe, expect, it } from "vitest";

import { defaultConfig } from "../src/config/defaults";
import type { Config } from "../src/config/types";
import { buildReviewModel, canSend, initialReviewState } from "../src/domain/review";
import type { ReviewModel } from "../src/domain/review";
import type { Attachment, FieldRecipient, MessageSnapshot } from "../src/domain/types";

function config(overrides: Partial<Config>): Config {
  return { ...defaultConfig, ...overrides };
}

function snapshot(overrides: Partial<MessageSnapshot>): MessageSnapshot {
  return {
    subject: "Subject",
    body: "Body",
    recipients: [],
    attachments: [],
    senderEmail: "me@example.com",
    ...overrides,
  };
}

const internal: FieldRecipient = { field: "to", displayName: "In", emailAddress: "in@example.com" };
const externalA: FieldRecipient = {
  field: "to",
  displayName: "Ext A",
  emailAddress: "a@other.com",
};
const externalB: FieldRecipient = {
  field: "cc",
  displayName: "Ext B",
  emailAddress: "b@other.com",
};
const realFile: Attachment = { id: "1", name: "report.pdf", size: 1000, isInline: false };
const inlineImage: Attachment = { id: "2", name: "logo.png", size: 50, isInline: true };

describe("buildReviewModel", () => {
  it("marks external recipients and lists unique external emails", () => {
    const model = buildReviewModel(
      snapshot({ recipients: [internal, externalA, externalB] }),
      defaultConfig,
    );
    expect(model.recipients.find((r) => r.emailAddress === "in@example.com")?.isExternal).toBe(
      false,
    );
    expect(model.externalEmails).toEqual(["a@other.com", "b@other.com"]);
  });

  it("deduplicates the same external email across fields", () => {
    const dupTo: FieldRecipient = { field: "to", displayName: "D", emailAddress: "dup@other.com" };
    const dupCc: FieldRecipient = { field: "cc", displayName: "D", emailAddress: "dup@other.com" };
    const model = buildReviewModel(snapshot({ recipients: [dupTo, dupCc] }), defaultConfig);
    expect(model.externalEmails).toEqual(["dup@other.com"]);
  });

  it("drops inline images from the attachment list", () => {
    const model = buildReviewModel(
      snapshot({ attachments: [realFile, inlineImage] }),
      defaultConfig,
    );
    expect(model.attachments).toEqual([{ name: "report.pdf", sizeBytes: 1000 }]);
  });

  it("raises an empty-subject warning when enabled and the subject is blank", () => {
    const model = buildReviewModel(snapshot({ subject: "  " }), defaultConfig);
    expect(model.warnings.some((w) => w.kind === "emptySubject")).toBe(true);
  });

  it("does not raise an empty-subject warning when disabled", () => {
    const model = buildReviewModel(
      snapshot({ subject: "  " }),
      config({ warnOnEmptySubject: false }),
    );
    expect(model.warnings.some((w) => w.kind === "emptySubject")).toBe(false);
  });

  it("raises a forgotten-attachment warning", () => {
    const model = buildReviewModel(
      snapshot({ body: "see attached", attachments: [] }),
      defaultConfig,
    );
    expect(model.warnings.some((w) => w.kind === "forgottenAttachment")).toBe(true);
  });

  it("raises an external-recipients warning with a count", () => {
    const model = buildReviewModel(snapshot({ recipients: [externalA, externalB] }), defaultConfig);
    const warning = model.warnings.find((w) => w.kind === "externalRecipients");
    expect(warning?.count).toBe(2);
  });

  it("requires recipient confirmation only when there are recipients", () => {
    const withRecipients = buildReviewModel(
      snapshot({ recipients: [internal, externalA, externalB] }),
      defaultConfig,
    );
    const withoutRecipients = buildReviewModel(snapshot({ recipients: [] }), defaultConfig);
    expect(withRecipients.requireRecipientConfirmation).toBe(true);
    expect(withoutRecipients.requireRecipientConfirmation).toBe(false);
  });

  it("requires attachment confirmation only when there are attachments", () => {
    const withFile = buildReviewModel(snapshot({ attachments: [realFile] }), defaultConfig);
    const withoutFile = buildReviewModel(snapshot({ attachments: [] }), defaultConfig);
    expect(withFile.requireAttachmentConfirmation).toBe(true);
    expect(withoutFile.requireAttachmentConfirmation).toBe(false);
  });

  it("floors and clamps the send delay to a non-negative integer", () => {
    const negative = buildReviewModel(snapshot({}), config({ sendDelaySeconds: -3 }));
    const fractional = buildReviewModel(snapshot({}), config({ sendDelaySeconds: 4.9 }));
    expect(negative.sendDelaySeconds).toBe(0);
    expect(fractional.sendDelaySeconds).toBe(4);
  });

  it("produces a JSON-serializable model", () => {
    const model = buildReviewModel(
      snapshot({ recipients: [externalA], attachments: [realFile] }),
      defaultConfig,
    );
    expect(() => JSON.stringify(model)).not.toThrow();
  });
});

describe("initialReviewState", () => {
  it("starts confirmations satisfied when they are not required", () => {
    const model = buildReviewModel(snapshot({}), config({ requireBodyConfirmation: false }));
    const state = initialReviewState(model);
    expect(state.bodyConfirmed).toBe(true);
  });

  it("starts the delay elapsed when there is no send delay", () => {
    const model = buildReviewModel(snapshot({}), config({ sendDelaySeconds: 0 }));
    const state = initialReviewState(model);
    expect(state.delayElapsed).toBe(true);
  });

  it("starts the delay not elapsed when there is a send delay", () => {
    const model = buildReviewModel(snapshot({}), config({ sendDelaySeconds: 5 }));
    const state = initialReviewState(model);
    expect(state.delayElapsed).toBe(false);
  });
});

describe("canSend", () => {
  function modelWith(overrides: Partial<MessageSnapshot>, cfg: Config): ReviewModel {
    return buildReviewModel(snapshot(overrides), cfg);
  }

  it("blocks while the delay has not elapsed", () => {
    const model = modelWith({}, config({ sendDelaySeconds: 5, requireBodyConfirmation: false }));
    const state = initialReviewState(model);
    expect(canSend(model, state)).toBe(false);
  });

  it("allows a plain message once the delay elapses and body is confirmed", () => {
    const model = modelWith({}, config({ sendDelaySeconds: 0 }));
    const state = { ...initialReviewState(model), bodyConfirmed: true };
    expect(canSend(model, state)).toBe(true);
  });

  it("blocks until the body is confirmed", () => {
    const model = modelWith({}, config({ sendDelaySeconds: 0 }));
    const state = initialReviewState(model);
    expect(canSend(model, state)).toBe(false);
  });

  it("blocks until every attachment is confirmed one by one", () => {
    const secondFile: Attachment = { id: "3", name: "data.csv", size: 2000, isInline: false };
    const model = modelWith(
      { attachments: [realFile, secondFile] },
      config({ sendDelaySeconds: 0, requireBodyConfirmation: false }),
    );
    const partial = { ...initialReviewState(model), confirmedAttachments: new Set([0]) };
    expect(canSend(model, partial)).toBe(false);
    const full = { ...initialReviewState(model), confirmedAttachments: new Set([0, 1]) };
    expect(canSend(model, full)).toBe(true);
  });

  it("blocks until every recipient is confirmed one by one", () => {
    // Several recipients spanning To and Cc, mixed internal and external.
    const model = modelWith(
      { recipients: [internal, externalA, externalB] },
      config({ sendDelaySeconds: 0, requireBodyConfirmation: false }),
    );
    const partial = {
      ...initialReviewState(model),
      confirmedRecipients: new Set([0, 1]),
    };
    expect(canSend(model, partial)).toBe(false);
    const full = {
      ...initialReviewState(model),
      confirmedRecipients: new Set([0, 1, 2]),
    };
    expect(canSend(model, full)).toBe(true);
  });
});
