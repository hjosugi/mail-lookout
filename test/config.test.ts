import { describe, expect, it } from "vitest";

import { defaultConfig } from "../src/config/defaults";
import { isLocaleTag } from "../src/i18n/catalog";

describe("defaultConfig", () => {
  it("has a non-empty list of internal domains", () => {
    expect(defaultConfig.internalDomains.length).toBeGreaterThan(0);
  });

  it("has a non-negative whole-number send delay", () => {
    expect(defaultConfig.sendDelaySeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(defaultConfig.sendDelaySeconds)).toBe(true);
  });

  it("has at least one attachment keyword", () => {
    expect(defaultConfig.attachmentKeywords.length).toBeGreaterThan(0);
  });

  it("uses a fallback locale that the catalog knows", () => {
    // A typo here would leave the add-in with no usable language
    // when the host language is unknown. So we check it is real.
    expect(isLocaleTag(defaultConfig.fallbackLocale)).toBe(true);
  });

  it("has dialog sizes within the 0 to 100 percent range", () => {
    expect(defaultConfig.dialog.widthPercent).toBeGreaterThan(0);
    expect(defaultConfig.dialog.widthPercent).toBeLessThanOrEqual(100);
    expect(defaultConfig.dialog.heightPercent).toBeGreaterThan(0);
    expect(defaultConfig.dialog.heightPercent).toBeLessThanOrEqual(100);
  });

  it("uses the browser runtime by default, not an iframe", () => {
    expect(defaultConfig.dialog.displayInIframe).toBe(false);
  });
});
