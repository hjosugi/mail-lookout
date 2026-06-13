import { describe, expect, it } from "vitest"

import {
  classifyRecipients,
  createExternalRecipientChecker,
  domainOf,
  isExternal,
  normalizeEmailAddress,
} from "@/domain/recipients"
import type { FieldRecipient } from "@/domain/types"

describe("normalizeEmailAddress", () => {
  it("trims and lowercases an email address", () => {
    expect(normalizeEmailAddress("  Alice@Example.COM ")).toBe("alice@example.com")
  })
})

describe("domainOf", () => {
  it("returns the domain part, lowercased", () => {
    expect(domainOf("Alice@Example.COM")).toBe("example.com")
  })

  it("returns empty string when there is no at sign", () => {
    expect(domainOf("not-an-email")).toBe("")
  })

  it("uses the last at sign", () => {
    expect(domainOf("weird@name@example.com")).toBe("example.com")
  })
})

describe("createExternalRecipientChecker", () => {
  it("reuses one normalized internal-domain set", () => {
    const isExternalRecipient = createExternalRecipientChecker([" Example.COM ", ""])
    expect(isExternalRecipient("alice@example.com")).toBe(false)
    expect(isExternalRecipient("bob@other.com")).toBe(true)
  })
})

describe("isExternal", () => {
  it("treats an internal domain as internal", () => {
    expect(isExternal("bob@example.com", ["example.com"])).toBe(false)
  })

  it("treats an unknown domain as external", () => {
    expect(isExternal("bob@other.com", ["example.com"])).toBe(true)
  })

  it("treats an address with no domain as external", () => {
    expect(isExternal("bob", ["example.com"])).toBe(true)
  })

  it("matches internal domains case-insensitively", () => {
    expect(isExternal("bob@EXAMPLE.com", ["example.com"])).toBe(false)
  })

  it("ignores empty entries in the internal list", () => {
    expect(isExternal("bob@example.com", ["", "  ", "example.com"])).toBe(false)
  })
})

describe("classifyRecipients", () => {
  const recipients: FieldRecipient[] = [
    { field: "to", displayName: "A", emailAddress: "a@example.com" },
    { field: "cc", displayName: "B", emailAddress: "b@other.com" },
    { field: "bcc", displayName: "C", emailAddress: "c@example.com" },
  ]

  it("splits into internal and external", () => {
    const result = classifyRecipients(recipients, ["example.com"])
    expect(result.internal.map(r => r.emailAddress)).toEqual(["a@example.com", "c@example.com"])
    expect(result.external.map(r => r.emailAddress)).toEqual(["b@other.com"])
  })

  it("puts everyone external when the internal list is empty", () => {
    const result = classifyRecipients(recipients, [])
    expect(result.external).toHaveLength(3)
    expect(result.internal).toHaveLength(0)
  })
})
