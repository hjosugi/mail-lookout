import type { Messages } from "../types";

/** English messages. */
export const en: Messages = {
  dialog: {
    title: "Confirm before sending",
    intro: "Check the recipients, attachments, and body before you send.",
    sendNow: "Send now",
    backToEdit: "Back to draft",
    sendInSeconds: (seconds) => `Send in ${seconds}s`,
  },
  sections: {
    recipients: "Recipients",
    attachments: "Attachments",
    subject: "Subject",
    body: "Body",
  },
  fields: {
    to: "To",
    cc: "Cc",
    bcc: "Bcc",
  },
  recipients: {
    externalBadge: "External",
    internalBadge: "Internal",
    confirmExternal: "I checked this external recipient",
    none: "No recipients",
  },
  attachments: {
    none: "No attachments",
    confirm: "I checked the attachments",
  },
  body: {
    confirm: "I checked the body",
    empty: "(No body text)",
  },
  warnings: {
    emptySubject: "The subject is empty.",
    forgottenAttachment: "The body mentions an attachment, but no file is attached.",
    externalRecipients: (count) =>
      `There ${count === 1 ? "is" : "are"} ${count} external recipient${count === 1 ? "" : "s"}.`,
  },
  fallback: {
    title: "Confirm before sending",
    externalLine: (count) =>
      `There ${count === 1 ? "is" : "are"} ${count} external recipient${count === 1 ? "" : "s"}.`,
    forgottenAttachmentLine: "The body mentions an attachment, but no file is attached.",
    emptySubjectLine: "The subject is empty.",
    reviewLine: "Please review the recipients and content before you send.",
  },
  cancel: {
    notSent: "The message was not sent. Return to your draft to review it.",
    returnLabel: "Back to draft",
  },
};
