/**
 * Recipient classification rules.
 *
 * The core question is simple: is this address inside the
 * organization or outside it? We answer it from the domain part
 * of the address and a list of internal domains.
 */

import type { FieldRecipient } from "./types"

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
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
}

/** Normalize a list of internal domains: lowercase, trim, drop empties. */
function normalizeDomains(internalDomains: readonly string[]): string[] {
  return internalDomains
    .map(domain => domain.trim().toLowerCase())
    .filter(domain => domain.length > 0)
}

/**
 * Decide if an address is external to the organization.
 *
 * An address with no domain is treated as external. We cannot
 * prove it is safe, so we warn to be safe.
 */
export function isExternal(email: string, internalDomains: readonly string[]): boolean {
  const domain = domainOf(email)
  if (domain === "") return true
  const internal = normalizeDomains(internalDomains)
  return !internal.includes(domain)
}

/** Recipients split into internal and external groups. */
export interface ClassifiedRecipients {
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
  for (const recipient of recipients) {
    if (isExternal(recipient.emailAddress, internalDomains)) {
      external.push(recipient)
    } else {
      internal.push(recipient)
    }
  }
  return { internal, external }
}
