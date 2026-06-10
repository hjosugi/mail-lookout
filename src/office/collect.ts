/// <reference types="office-js" />

/**
 * Read the message being composed into a plain snapshot.
 *
 * This is the bridge from Office to the domain layer. Every read
 * runs in parallel with Promise.all, so the handler itself is
 * fast. The slow part is the user reviewing the dialog, not us.
 */

import type { Attachment, FieldRecipient, MessageSnapshot, RecipientField } from "../domain/types"
import { normalizeEmailAddress } from "../domain/recipients"
import { promisify } from "./officeAsync"

/** Map host recipient details to our recipient type. */
function mapRecipients(
  details: readonly Office.EmailAddressDetails[],
  field: RecipientField,
): FieldRecipient[] {
  return details.map(detail => ({
    field,
    displayName: detail.displayName ?? "",
    emailAddress: normalizeEmailAddress(detail.emailAddress ?? ""),
  }))
}

/** Map host attachment details to our attachment type. */
function mapAttachments(details: readonly Office.AttachmentDetailsCompose[]): Attachment[] {
  return details.map(detail => ({
    id: detail.id,
    name: detail.name,
    size: typeof detail.size === "number" ? detail.size : null,
    isInline: detail.isInline === true,
  }))
}

/**
 * Collect a full snapshot of the compose message.
 *
 * Reads subject, body, To, Cc, Bcc, and attachments at once.
 */
export async function collectSnapshot(item: Office.MessageCompose): Promise<MessageSnapshot> {
  const [subject, body, to, cc, bcc, attachments] = await Promise.all([
    promisify<string>(cb => item.subject.getAsync(cb)),
    promisify<string>(cb => item.body.getAsync(Office.CoercionType.Text, cb)),
    promisify<Office.EmailAddressDetails[]>(cb => item.to.getAsync(cb)),
    promisify<Office.EmailAddressDetails[]>(cb => item.cc.getAsync(cb)),
    promisify<Office.EmailAddressDetails[]>(cb => item.bcc.getAsync(cb)),
    promisify<Office.AttachmentDetailsCompose[]>(cb => item.getAttachmentsAsync(cb)),
  ])

  const recipients: FieldRecipient[] = [
    ...mapRecipients(to, "to"),
    ...mapRecipients(cc, "cc"),
    ...mapRecipients(bcc, "bcc"),
  ]

  const senderEmail: string = normalizeEmailAddress(
    Office.context.mailbox.userProfile.emailAddress ?? "",
  )

  return {
    subject,
    body,
    recipients,
    attachments: mapAttachments(attachments),
    senderEmail,
  }
}
