import { describe, expect, it } from "vitest"

import { defaultConfig } from "../src/config/defaults"
import { buildReviewModel } from "../src/domain/review"
import type { FieldRecipient, MessageSnapshot } from "../src/domain/types"
import { getMessages } from "../src/i18n/catalog"
import { buildFallbackMessage } from "../src/office/fallbackMessage"

function snapshot(overrides: Partial<MessageSnapshot>): MessageSnapshot {
  return {
    subject: "Subject",
    body: "Body",
    recipients: [],
    attachments: [],
    senderEmail: "me@example.com",
    ...overrides,
  }
}

// Several recipients spanning To/Cc/Bcc, mixed internal and external,
// so the external list is exercised the way real mail looks.
const recipients: FieldRecipient[] = [
  { field: "to", displayName: "In", emailAddress: "in@example.com" },
  { field: "to", displayName: "Ext A", emailAddress: "a@partner.test" },
  { field: "cc", displayName: "Ext B", emailAddress: "b@vendor.test" },
  { field: "bcc", displayName: "Ext C", emailAddress: "c@client.test" },
]

const en = getMessages("en")

describe("buildFallbackMessage", () => {
  it("lists every external recipient in text and markdown", () => {
    const model = buildReviewModel(snapshot({ recipients }), defaultConfig)
    const message = buildFallbackMessage(model, "en")
    expect(message.text).toContain(en.fallback.externalLine(3))
    expect(message.markdown).toContain(`**${en.fallback.externalLine(3)}**`)
    for (const email of ["a@partner.test", "b@vendor.test", "c@client.test"]) {
      expect(message.text).toContain(email)
      expect(message.markdown).toContain(`- ${email}\r`)
    }
  })

  it("includes the forgotten-attachment line when warned", () => {
    const model = buildReviewModel(
      snapshot({ body: "see attached", attachments: [] }),
      defaultConfig,
    )
    expect(buildFallbackMessage(model, "en").text).toContain(en.fallback.forgottenAttachmentLine)
  })

  it("includes the empty-subject line when warned", () => {
    const model = buildReviewModel(snapshot({ subject: "  " }), defaultConfig)
    expect(buildFallbackMessage(model, "en").text).toContain(en.fallback.emptySubjectLine)
  })

  it("always ends with the review line", () => {
    const model = buildReviewModel(snapshot({}), defaultConfig)
    expect(buildFallbackMessage(model, "en").text.endsWith(en.fallback.reviewLine)).toBe(true)
  })

  it("orders concerns: external, then forgotten attachment, then empty subject, then review", () => {
    const model = buildReviewModel(
      snapshot({ subject: "  ", body: "see attached", recipients, attachments: [] }),
      defaultConfig,
    )
    const { text } = buildFallbackMessage(model, "en")
    const order = [
      text.indexOf(en.fallback.externalLine(3)),
      text.indexOf(en.fallback.forgottenAttachmentLine),
      text.indexOf(en.fallback.emptySubjectLine),
      text.indexOf(en.fallback.reviewLine),
    ]
    expect(order.every(index => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("uses the requested locale", () => {
    const ja = getMessages("ja")
    const model = buildReviewModel(snapshot({ recipients }), defaultConfig)
    expect(buildFallbackMessage(model, "ja").text).toContain(ja.fallback.externalLine(3))
  })
})
