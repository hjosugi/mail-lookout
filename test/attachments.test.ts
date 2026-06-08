import { describe, expect, it } from "vitest";

import {
  detectForgottenAttachment,
  mentionsAttachment,
  realAttachments,
} from "../src/domain/attachments";
import type { Attachment, MessageSnapshot } from "../src/domain/types";

function snapshot(overrides: Partial<MessageSnapshot>): MessageSnapshot {
  return {
    subject: "",
    body: "",
    recipients: [],
    attachments: [],
    senderEmail: "me@example.com",
    ...overrides,
  };
}

const realFile: Attachment = { id: "1", name: "report.pdf", size: 1000, isInline: false };
const inlineImage: Attachment = { id: "2", name: "logo.png", size: 50, isInline: true };

describe("realAttachments", () => {
  it("keeps real files and drops inline images", () => {
    const result = realAttachments([realFile, inlineImage]);
    expect(result).toEqual([realFile]);
  });
});

describe("mentionsAttachment", () => {
  it("matches a keyword case-insensitively", () => {
    expect(mentionsAttachment("Please see the ATTACHED file", ["attached"])).toBe(true);
  });

  it("matches a Japanese keyword", () => {
    expect(mentionsAttachment("資料を添付します", ["添付"])).toBe(true);
  });

  it("returns false when no keyword is present", () => {
    expect(mentionsAttachment("hello there", ["attached", "添付"])).toBe(false);
  });

  it("skips empty keywords", () => {
    expect(mentionsAttachment("hello", ["", "  "])).toBe(false);
  });
});

describe("detectForgottenAttachment", () => {
  it("flags when the body mentions an attachment but none is attached", () => {
    const result = detectForgottenAttachment(snapshot({ body: "see attached" }), ["attached"]);
    expect(result).toBe(true);
  });

  it("flags when the subject mentions an attachment but none is attached", () => {
    const result = detectForgottenAttachment(snapshot({ subject: "添付あり" }), ["添付"]);
    expect(result).toBe(true);
  });

  it("does not flag when a real attachment exists", () => {
    const result = detectForgottenAttachment(
      snapshot({ body: "see attached", attachments: [realFile] }),
      ["attached"],
    );
    expect(result).toBe(false);
  });

  it("ignores inline images when deciding", () => {
    const result = detectForgottenAttachment(
      snapshot({ body: "see attached", attachments: [inlineImage] }),
      ["attached"],
    );
    expect(result).toBe(true);
  });

  it("does not flag when nothing mentions an attachment", () => {
    const result = detectForgottenAttachment(snapshot({ body: "hello" }), ["attached"]);
    expect(result).toBe(false);
  });
});
