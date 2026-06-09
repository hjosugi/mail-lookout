/**
 * Public surface of the domain layer.
 *
 * Other layers import from here, not from individual files.
 */

export type {
  Attachment,
  FieldRecipient,
  MessageSnapshot,
  Recipient,
  RecipientField,
} from "./types"

export { domainOf, isExternal, classifyRecipients } from "./recipients"
export type { ClassifiedRecipients } from "./recipients"

export { realAttachments, mentionsAttachment, detectForgottenAttachment } from "./attachments"

export { isBlank, isSubjectEmpty, bodyPreview } from "./body"

export { BODY_PREVIEW_MAX_LENGTH, buildReviewModel, initialReviewState, canSend } from "./review"
export type {
  AttachmentView,
  RecipientView,
  ReviewModel,
  ReviewState,
  Warning,
  WarningKind,
} from "./review"
