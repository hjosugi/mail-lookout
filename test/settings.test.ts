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

describe("normalizeSettings", () => {
  it("trims, lowercases, de-dupes, and floors the delay", () => {
    expect(
      normalizeSettings({ internalDomains: [" X.com", "x.com"], sendDelaySeconds: 90.7 }),
    ).toEqual({ internalDomains: ["x.com"], sendDelaySeconds: 90 })
  })

  it("throws when there are no internal domains", () => {
    expect(() => normalizeSettings({ internalDomains: [], sendDelaySeconds: 60 })).toThrow()
  })
})
