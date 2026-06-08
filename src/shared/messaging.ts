/**
 * The message protocol between the handler and the dialog.
 *
 * The send handler runs in one context. The dialog runs in
 * another. They talk only through JSON strings. These types name
 * every message that can cross that line, so both sides agree.
 */

import type { LocaleTag } from "../i18n/catalog";
import type { ReviewModel } from "../domain/review";

/** Messages sent from the parent handler to the dialog. */
export interface ParentToDialog {
  readonly type: "init";
  readonly model: ReviewModel;
  readonly locale: LocaleTag;
}

/** Messages sent from the dialog back to the parent handler. */
export type DialogToParent =
  | { readonly type: "ready" }
  | { readonly type: "decision"; readonly allow: boolean };

/** Encode a message to a JSON string. */
export function encode(message: ParentToDialog | DialogToParent): string {
  return JSON.stringify(message);
}

/**
 * Decode a JSON string to a message.
 *
 * Returns null if the string is not valid JSON. The caller is
 * trusted to pass the right type parameter; this is a private
 * channel between our own code.
 */
export function decode<T extends ParentToDialog | DialogToParent>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
