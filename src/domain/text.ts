/** Shared text helpers for simple case-insensitive rules. */

/** Trim and lowercase a value before case-insensitive comparison. */
export function normalizeForCaseInsensitiveMatch(value: string): string {
  return value.trim().toLowerCase()
}

/** Normalize a list of values and drop empty results. */
export function normalizeNonEmptyForCaseInsensitiveMatch(values: readonly string[]): string[] {
  return values.map(normalizeForCaseInsensitiveMatch).filter(value => value.length > 0)
}

/** Return true when text contains any non-empty candidate, case-insensitively. */
export function includesAnyCaseInsensitive(text: string, candidates: readonly string[]): boolean {
  const haystack = text.toLowerCase()
  return normalizeNonEmptyForCaseInsensitiveMatch(candidates).some(candidate =>
    haystack.includes(candidate),
  )
}
