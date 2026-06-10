/**
 * The message protocol between the handler and the dialog.
 *
 * The send handler runs in one context. The dialog runs in
 * another. They talk only through JSON strings. These types name
 * every message that can cross that line, so both sides agree.
 *
 * The strings arrive from a separate window over the Office dialog
 * channel, so decoding does not trust them. Each message is parsed
 * against a schema and rejected (null) when it does not match,
 * rather than cast and hoped for.
 */

import { z } from "zod"

import { supportedLocales } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import type { ReviewModel } from "../domain/review"

/** Message type names shared by both sides of the dialog protocol. */
export const MessageType = {
  Init: "init",
  Ready: "ready",
  Decision: "decision",
} as const

export type MessageType = (typeof MessageType)[keyof typeof MessageType]

/** Messages sent from the parent handler to the dialog. */
export interface ParentToDialog {
  readonly type: typeof MessageType.Init
  readonly model: ReviewModel
  readonly locale: LocaleTag
}

/** Messages sent from the dialog back to the parent handler. */
export type DialogToParent =
  | { readonly type: typeof MessageType.Ready }
  | { readonly type: typeof MessageType.Decision; readonly allow: boolean }

// --- Schemas -------------------------------------------------------------
//
// These mirror the protocol types above and the ReviewModel they
// carry. They run at the trust boundary: a message that does not
// match is rejected rather than cast. The compile-time checks below
// prove each schema still matches its hand-written type.

// Built from the locale registry, so it can never drift from the
// set of locales we actually ship.
const localeTagSchema = z.enum(supportedLocales as [LocaleTag, ...LocaleTag[]])

const recipientViewSchema = z.object({
  field: z.enum(["to", "cc", "bcc"]),
  displayName: z.string(),
  emailAddress: z.string(),
  isExternal: z.boolean(),
})

const attachmentViewSchema = z.object({
  name: z.string(),
  sizeBytes: z.number().nullable(),
})

const warningSchema = z.object({
  kind: z.enum(["emptySubject", "forgottenAttachment", "externalRecipients"]),
  count: z.number(),
})

const reviewModelSchema = z.object({
  subject: z.string(),
  bodyPreview: z.string(),
  recipients: z.array(recipientViewSchema),
  attachments: z.array(attachmentViewSchema),
  externalEmails: z.array(z.string()),
  warnings: z.array(warningSchema),
  sendDelaySeconds: z.number(),
  requireRecipientConfirmation: z.boolean(),
  requireAttachmentConfirmation: z.boolean(),
  requireBodyConfirmation: z.boolean(),
})

const parentToDialogSchema = z.object({
  type: z.literal(MessageType.Init),
  model: reviewModelSchema,
  locale: localeTagSchema,
})

const dialogToParentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(MessageType.Ready) }),
  z.object({ type: z.literal(MessageType.Decision), allow: z.boolean() }),
])

// --- Compile-time agreement checks --------------------------------------
//
// If a schema drifts from its protocol type (a field added to one
// but not the other, a literal renamed), one of these stops
// compiling. They cost nothing at runtime.

type DeepWritable<T> = T extends readonly (infer U)[]
  ? DeepWritable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
    : T

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

// Exported only so the unused-locals check keeps it; it is purely a
// type, with no runtime presence. If a schema drifts from its protocol
// type, one `true` below becomes `false` and this stops compiling.
export type SchemasMatchProtocol = [
  Assert<Exact<z.infer<typeof parentToDialogSchema>, DeepWritable<ParentToDialog>>>,
  Assert<Exact<z.infer<typeof dialogToParentSchema>, DeepWritable<DialogToParent>>>,
]

// --- Encode / decode -----------------------------------------------------

/** Encode a message to a JSON string. */
export function encode(message: ParentToDialog | DialogToParent): string {
  return JSON.stringify(message)
}

/** Parse a JSON string, or undefined if it is not valid JSON. */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Decode a parent-to-dialog message, or null if it does not match.
 *
 * Null covers both failures the caller treats the same way: the
 * string was not valid JSON, or it did not satisfy the schema.
 */
export function decodeParentToDialog(raw: string): ParentToDialog | null {
  const result = parentToDialogSchema.safeParse(parseJson(raw))
  return result.success ? result.data : null
}

/** Decode a dialog-to-parent message, or null if it does not match. */
export function decodeDialogToParent(raw: string): DialogToParent | null {
  const result = dialogToParentSchema.safeParse(parseJson(raw))
  return result.success ? result.data : null
}
