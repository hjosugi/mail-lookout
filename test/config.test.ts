import { describe, expect, it } from "vitest"

import { defaultConfig } from "@/config/defaults"
import { configSchema } from "@/config/types"
import { isLocaleTag } from "@/i18n/catalog"

describe("defaultConfig", () => {
  it("has a non-empty list of internal domains", () => {
    expect(defaultConfig.internalDomains.length).toBeGreaterThan(0)
  })

  it("has a non-negative whole-number send delay", () => {
    expect(defaultConfig.sendDelaySeconds).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(defaultConfig.sendDelaySeconds)).toBe(true)
  })

  it("has at least one attachment keyword", () => {
    expect(defaultConfig.attachmentKeywords.length).toBeGreaterThan(0)
  })

  it("uses a fallback locale that the catalog knows", () => {
    // A typo here would leave the add-in with no usable language
    // when the host language is unknown. So we check it is real.
    expect(isLocaleTag(defaultConfig.fallbackLocale)).toBe(true)
  })

  it("has dialog sizes within the 0 to 100 percent range", () => {
    expect(defaultConfig.dialog.widthPercent).toBeGreaterThan(0)
    expect(defaultConfig.dialog.widthPercent).toBeLessThanOrEqual(100)
    expect(defaultConfig.dialog.heightPercent).toBeGreaterThan(0)
    expect(defaultConfig.dialog.heightPercent).toBeLessThanOrEqual(100)
  })

  it("uses an iframe dialog by default for Outlook on the web", () => {
    expect(defaultConfig.dialog.displayInIframe).toBe(true)
  })
})

describe("configSchema", () => {
  it("accepts the default config", () => {
    expect(configSchema.safeParse(defaultConfig).success).toBe(true)
  })

  it("rejects a negative send delay", () => {
    expect(configSchema.safeParse({ ...defaultConfig, sendDelaySeconds: -1 }).success).toBe(false)
  })

  it("rejects a fractional send delay", () => {
    expect(configSchema.safeParse({ ...defaultConfig, sendDelaySeconds: 1.5 }).success).toBe(false)
  })

  it("rejects a dialog width over 100 percent", () => {
    const bad = { ...defaultConfig, dialog: { ...defaultConfig.dialog, widthPercent: 150 } }
    expect(configSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects an unknown fallback locale", () => {
    expect(configSchema.safeParse({ ...defaultConfig, fallbackLocale: "de" }).success).toBe(false)
  })

  it("rejects an empty internal-domain list", () => {
    expect(configSchema.safeParse({ ...defaultConfig, internalDomains: [] }).success).toBe(false)
  })
})
