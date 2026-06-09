/**
 * Public surface of the i18n layer.
 */

export type { Messages } from "./types"
export { locales, supportedLocales, isLocaleTag, resolveLocale, getMessages } from "./catalog"
export type { LocaleTag } from "./catalog"
