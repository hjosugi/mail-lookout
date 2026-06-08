/**
 * Subject and body rules.
 *
 * Small helpers to check for empty text and to build a short,
 * clean preview of the body for the dialog.
 */

import type { MessageSnapshot } from "./types";

/** Return true if the text is empty or only whitespace. */
export function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/** Return true if the subject is empty. */
export function isSubjectEmpty(snapshot: MessageSnapshot): boolean {
  return isBlank(snapshot.subject);
}

/**
 * Build a short preview of the body.
 *
 * Runs of whitespace collapse to one space. If the text is longer
 * than maxLength, it is cut and an ellipsis is added.
 */
export function bodyPreview(body: string, maxLength: number): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return collapsed.slice(0, maxLength).trimEnd() + "\u2026";
}
