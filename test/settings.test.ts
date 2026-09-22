import { describe, expect, it } from "vitest"

import { defaultConfig } from "@/config/defaults"
import { applySettings, normalizeSettings } from "@/config/settings"

describe("applySettings", () => {
  it("returns the defaults when there are no overrides", () => {
    expect(applySettings({})).toEqual(defaultConfig)
  })

  it("overlays valid overrides, lowercasing and de-duping domains", () => {
    const config = applySettings({
      internalDomains: ["A.com", " b.com ", "a.com", ""],
      sendDelaySeconds: 90,
    })
    expect(config.internalDomains).toEqual(["a.com", "b.com"])
    expect(config.sendDelaySeconds).toBe(90)
  })

  it("falls back to defaults for invalid values", () => {
    const config = applySettings({
      internalDomains: [],
      sendDelaySeconds: -5,
    })
    expect(config.internalDomains).toEqual(defaultConfig.internalDomains)
    expect(config.sendDelaySeconds).toBe(defaultConfig.sendDelaySeconds)
  })

  it("ignores values of the wrong type", () => {
    const config = applySettings({
      internalDomains: "example.org",
      sendDelaySeconds: "120",
    })
    expect(config).toEqual(defaultConfig)
  })
})

/** The boolean settings at their shipped values, for tests about the rest. */
const booleanDefaults = {
  requireRecipientConfirmation: defaultConfig.requireRecipientConfirmation,
  requireAttachmentConfirmation: defaultConfig.requireAttachmentConfirmation,
  requireBodyConfirmation: defaultConfig.requireBodyConfirmation,
  allowSendAnyway: defaultConfig.allowSendAnyway,
}

describe("normalizeSettings", () => {
  it("trims, lowercases, de-dupes, and floors the delay", () => {
    expect(
      normalizeSettings({
        internalDomains: [" X.com", "x.com"],
        sendDelaySeconds: 90.7,
        ...booleanDefaults,
      }),
    ).toEqual({ internalDomains: ["x.com"], sendDelaySeconds: 90, ...booleanDefaults })
  })

  it("throws when there are no internal domains", () => {
    expect(() =>
      normalizeSettings({ internalDomains: [], sendDelaySeconds: 60, ...booleanDefaults }),
    ).toThrow()
  })

  it("carries the booleans through unchanged", () => {
    const settings = normalizeSettings({
      internalDomains: ["x.com"],
      sendDelaySeconds: 0,
      requireRecipientConfirmation: false,
      requireAttachmentConfirmation: false,
      requireBodyConfirmation: false,
      allowSendAnyway: true,
    })
    expect(settings.requireRecipientConfirmation).toBe(false)
    expect(settings.requireAttachmentConfirmation).toBe(false)
    expect(settings.requireBodyConfirmation).toBe(false)
    expect(settings.allowSendAnyway).toBe(true)
  })
})

describe("the boolean settings", () => {
  it("overlays them when they are booleans", () => {
    const config = applySettings({
      requireRecipientConfirmation: false,
      requireAttachmentConfirmation: false,
      requireBodyConfirmation: false,
      allowSendAnyway: true,
    })
    expect(config.requireRecipientConfirmation).toBe(false)
    expect(config.requireAttachmentConfirmation).toBe(false)
    expect(config.requireBodyConfirmation).toBe(false)
    expect(config.allowSendAnyway).toBe(true)
  })

  // Storage is untrusted, and "send anyway" is the one setting where a
  // wrong answer weakens the add-in rather than annoying the user.
  it("falls back to the strict default for non-boolean values", () => {
    const config = applySettings({
      allowSendAnyway: "true",
      requireBodyConfirmation: 1,
    })
    expect(config.allowSendAnyway).toBe(false)
    expect(config.requireBodyConfirmation).toBe(true)
  })

  it("ships with send-anyway off", () => {
    expect(defaultConfig.allowSendAnyway).toBe(false)
  })
})
