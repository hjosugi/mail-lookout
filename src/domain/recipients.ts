/**
 * Recipient classification rules.
 *
 * The core question is simple: is this address inside the
 * organization or outside it? We answer it from the domain part
 * of the address and a list of internal domains.
 */

import type { FieldRecipient } from "./types"
import { normalizeForCaseInsensitiveMatch, normalizeNonEmptyForCaseInsensitiveMatch } from "./text"

/** Normalize an email address for storage and comparison. */
export function normalizeEmailAddress(email: string): string {
  return normalizeForCaseInsensitiveMatch(email)
}

/**
 * Return the domain part of an email address.
 *
 * "alice@example.com" returns "example.com".
 * An address with no "@" returns "".
 */
export function domainOf(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 0) {
    return ""
  }
  return normalizeForCaseInsensitiveMatch(email.slice(at + 1))
}

/** Normalize a list of internal domains: lowercase, trim, drop empties. */
function normalizeDomainSet(internalDomains: readonly string[]): ReadonlySet<string> {
  return new Set(normalizeNonEmptyForCaseInsensitiveMatch(internalDomains))
}

/** Build a reusable checker for one internal-domain configuration. */
export function createExternalRecipientChecker(
  internalDomains: readonly string[],
): (email: string) => boolean {
  const internal = normalizeDomainSet(internalDomains)
  return email => {
    const domain = domainOf(email)
    return domain === "" || !internal.has(domain)
  }
}

/**
 * Decide if an address is external to the organization.
 *
 * An address with no domain is treated as external. We cannot
 * prove it is safe, so we warn to be safe.
 */
export function isExternal(email: string, internalDomains: readonly string[]): boolean {
  return createExternalRecipientChecker(internalDomains)(email)
}

/** Recipients split into internal and external groups. */
interface ClassifiedRecipients {
  readonly internal: readonly FieldRecipient[]
  readonly external: readonly FieldRecipient[]
}

/** Split recipients into internal and external groups. */
export function classifyRecipients(
  recipients: readonly FieldRecipient[],
  internalDomains: readonly string[],
): ClassifiedRecipients {
  const internal: FieldRecipient[] = []
  const external: FieldRecipient[] = []
  const isExternalRecipient = createExternalRecipientChecker(internalDomains)
  for (const recipient of recipients) {
    if (isExternalRecipient(recipient.emailAddress)) {
      external.push(recipient)
    } else {
      internal.push(recipient)
    }
  }
  return { internal, external }
}
