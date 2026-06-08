/**
 * Pure domain types for the send-confirmation logic.
 *
 * This file has no dependency on the Office JavaScript API.
 * It models an email message as plain, immutable data so that
 * every rule can be unit tested without Outlook.
 */

/** A single email recipient. */
export interface Recipient {
  /** The name shown to the user. May be empty. */
  readonly displayName: string;
  /** The SMTP address, lowercased and trimmed. */
  readonly emailAddress: string;
}

/** Which header field a recipient sits in. */
export type RecipientField = "to" | "cc" | "bcc";

/** A recipient together with the field it belongs to. */
export interface FieldRecipient extends Recipient {
  readonly field: RecipientField;
}

/** A file attached to the message. */
export interface Attachment {
  /** The attachment id from the host. */
  readonly id: string;
  /** The file name shown to the user. */
  readonly name: string;
  /** The size in bytes, or null if the host did not report it. */
  readonly size: number | null;
  /** True if the attachment is inline (for example, a pasted image). */
  readonly isInline: boolean;
}

/**
 * A snapshot of the message at send time.
 *
 * This is the only input the domain layer needs. The Office layer
 * builds it; the domain layer reads it.
 */
export interface MessageSnapshot {
  /** The subject line. */
  readonly subject: string;
  /** The body as plain text. */
  readonly body: string;
  /** All recipients across To, Cc, and Bcc. */
  readonly recipients: readonly FieldRecipient[];
  /** All attachments, inline and real. */
  readonly attachments: readonly Attachment[];
  /** The sender address, lowercased and trimmed. */
  readonly senderEmail: string;
}
