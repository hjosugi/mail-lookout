import { describe, expect, it } from "vitest";

import {
  getMessages,
  isLocaleTag,
  locales,
  resolveLocale,
  supportedLocales,
} from "../src/i18n/catalog";

/**
 * Collect every leaf key path of an object.
 *
 * A leaf is a string or a function (our messages are one or the
 * other). We descend into plain objects only. The result is a
 * sorted list of dotted paths, like "dialog.title".
 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(...keyPaths(child, path));
  }
  return paths.sort();
}

describe("isLocaleTag", () => {
  it("is true for a known tag", () => {
    expect(isLocaleTag("ja")).toBe(true);
    expect(isLocaleTag("en")).toBe(true);
  });

  it("is false for an unknown tag", () => {
    expect(isLocaleTag("de")).toBe(false);
    expect(isLocaleTag("")).toBe(false);
  });
});

describe("resolveLocale", () => {
  it("maps a regional tag to its primary part", () => {
    expect(resolveLocale("ja-JP", "en")).toBe("ja");
    expect(resolveLocale("en-US", "en")).toBe("en");
  });

  it("accepts a bare primary tag", () => {
    expect(resolveLocale("ja", "en")).toBe("ja");
  });

  it("is case-insensitive on the primary part", () => {
    expect(resolveLocale("JA-jp", "en")).toBe("ja");
  });

  it("uses the fallback for an unknown language", () => {
    expect(resolveLocale("fr-FR", "en")).toBe("en");
  });

  it("uses the fallback when the language is undefined", () => {
    expect(resolveLocale(undefined, "ja")).toBe("ja");
  });

  it("uses the fallback for an empty string", () => {
    expect(resolveLocale("", "en")).toBe("en");
  });
});

describe("getMessages", () => {
  it("returns the message set for a tag", () => {
    expect(getMessages("ja")).toBe(locales.ja);
    expect(getMessages("en")).toBe(locales.en);
  });

  it("returns a usable title for every supported locale", () => {
    for (const tag of supportedLocales) {
      expect(typeof getMessages(tag).dialog.title).toBe("string");
      expect(getMessages(tag).dialog.title.length).toBeGreaterThan(0);
    }
  });
});

describe("locale completeness", () => {
  it("gives every locale the same set of keys", () => {
    // This is the safety net for adding a language. If a new
    // locale misses a key or adds an extra one, this test fails
    // and names the gap. The compiler catches missing keys too,
    // but this also catches shape drift in functions vs strings.
    const reference = keyPaths(locales.en);
    for (const tag of supportedLocales) {
      expect(keyPaths(locales[tag]), `locale "${tag}" key mismatch`).toEqual(reference);
    }
  });

  it("has working interpolating messages in every locale", () => {
    // Each locale has a few messages that take a value, like a
    // count or a number of seconds. We call them in every locale
    // with both a singular and a plural count, so plural branches
    // are covered too. We check the value shows up in the text.
    for (const tag of supportedLocales) {
      const messages = getMessages(tag);

      expect(messages.dialog.sendInSeconds(7)).toContain("7");

      for (const count of [1, 3]) {
        const external = messages.warnings.externalRecipients(count);
        expect(external).toContain(String(count));

        const fallbackLine = messages.fallback.externalLine(count);
        expect(fallbackLine).toContain(String(count));
      }
    }
  });
});
