import { describe, expect, it } from "vitest"

import { bodyPreview, isBlank, isSubjectEmpty } from "../src/domain/body"
import type { MessageSnapshot } from "../src/domain/types"

function snapshot(subject: string): MessageSnapshot {
  return {
    subject,
    body: "",
    recipients: [],
    attachments: [],
    senderEmail: "me@example.com",
  }
}

describe("isBlank", () => {
  it("is true for an empty string", () => {
    expect(isBlank("")).toBe(true)
  })

  it("is true for whitespace only", () => {
    expect(isBlank("   \n\t ")).toBe(true)
  })

  it("is false for real text", () => {
    expect(isBlank(" hi ")).toBe(false)
  })
})

describe("isSubjectEmpty", () => {
  it("is true when the subject is blank", () => {
    expect(isSubjectEmpty(snapshot("  "))).toBe(true)
  })

  it("is false when the subject has text", () => {
    expect(isSubjectEmpty(snapshot("Hello"))).toBe(false)
  })
})

describe("bodyPreview", () => {
  it("collapses runs of whitespace into one space", () => {
    expect(bodyPreview("a\n\n  b\t c", 100)).toBe("a b c")
  })

  it("returns the text as is when under the limit", () => {
    expect(bodyPreview("short text", 100)).toBe("short text")
  })

  it("cuts and adds an ellipsis when over the limit", () => {
    const result = bodyPreview("abcdefghij", 5)
    expect(result).toBe("abcde\u2026")
  })

  it("trims trailing space before the ellipsis", () => {
    const result = bodyPreview("ab cdef", 3)
    expect(result).toBe("ab\u2026")
  })
})
