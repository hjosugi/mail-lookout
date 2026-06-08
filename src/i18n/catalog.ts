/**
 * The locale registry.
 *
 * This is the one place that knows every language. Adding a
 * language is a one-line change in `locales` below. The
 * `satisfies` check makes sure each locale is a full `Messages`,
 * and `LocaleTag` updates on its own from the keys.
 */

import type { Messages } from "./types";
import { ja } from "./locales/ja";
import { en } from "./locales/en";

/**
 * All known locales.
 *
 * To add a language: import its `Messages` object and add one
 * line here, for example `de,`. Nothing else needs to change.
 */
export const locales = {
  ja,
  en,
} satisfies Record<string, Messages>;

/** A valid locale tag, derived from the keys of `locales`. */
export type LocaleTag = keyof typeof locales;

/** Every supported locale tag, as an array. */
export const supportedLocales = Object.keys(locales) as LocaleTag[];

/** Type guard: is this string one of our locale tags? */
export function isLocaleTag(value: string): value is LocaleTag {
  return Object.prototype.hasOwnProperty.call(locales, value);
}

/**
 * Pick a locale from the host display language.
 *
 * The host gives something like "ja-JP" or "en-US". We take the
 * primary part ("ja", "en"). If it is unknown, we use the
 * fallback.
 */
export function resolveLocale(displayLanguage: string | undefined, fallback: LocaleTag): LocaleTag {
  if (!displayLanguage) {
    return fallback;
  }
  const primary = displayLanguage.split("-")[0]?.toLowerCase() ?? "";
  return isLocaleTag(primary) ? primary : fallback;
}

/** Get the message set for a locale tag. */
export function getMessages(tag: LocaleTag): Messages {
  return locales[tag];
}
