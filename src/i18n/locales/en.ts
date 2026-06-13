import type { Messages } from "../types"

/** English messages. */
export const en: Messages = {
  dialog: {
    title: "Review before sending",
    intro: "Review the recipients, attachments, and body before sending.",
    sendNow: "Send now",
    backToEdit: "Back to draft",
    cancelSend: "Cancel",
    sendingInSeconds: seconds => `Sending in ${seconds}s…`,
    delayLabel: "Wait before sending",
    delayUnitMinutes: "min",
    delayImmediateHint: "0 = send immediately",
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
    confirmHint: "Review each recipient.",
    none: "No recipients",
  },
  attachments: {
    none: "No attachments",
    confirmHint: "Review each attachment.",
  },
  body: {
    confirm: "I reviewed the body",
    empty: "(No body text)",
  },
  subject: {
    empty: "(No subject)",
    confirmEmpty: "Send without a subject",
  },
  warnings: {
    emptySubject: "The subject is empty.",
    forgottenAttachment: "The body mentions an attachment, but no file is attached.",
    externalRecipients: count =>
      `There ${count === 1 ? "is" : "are"} ${count} external recipient${count === 1 ? "" : "s"}.`,
  },
  smartAlert: {
    prompt: "Review the required items.",
    waiting: "Sending is on hold.",
    openReview: "Open review",
    showWaiting: "Open status",
  },
  taskPane: {
    title: "Review before sending",
    intro: "Review the required items, then select Review & send.",
    confirm: "Review & send",
    holding: "Waiting to send…",
    sending: "Sending…",
    sendFailed: "Couldn't send. Please try again.",
    loadFailed: "The review pane could not load. Return to your draft and review it.",
  },
  waiting: {
    othersTitle: "Also waiting to send",
    settingsTitle: "Waiting to send",
    empty: "No messages are waiting to send.",
    recipients: count => `${count} recipient${count === 1 ? "" : "s"}`,
    remaining: text => `${text} left`,
    capReached: max => `The send-wait limit (${max}) is reached. Wait until one message sends.`,
    retry: "Retry",
  },
  cancel: {
    notSent: "The message was not sent. Return to your draft to review it.",
    returnLabel: "Back to draft",
  },
  settings: {
    title: "Settings",
    intro: "These settings apply on this device only.",
    domainsLabel: "Internal domains",
    domainsHint: "One per line. Recipients on any other domain are treated as external.",
    delayLabel: "Default wait",
    delayHint: "The starting countdown after you select Review & send.",
    delayUnit: "min",
    save: "Save",
    saved: "Saved.",
    reset: "Reset to defaults",
    invalid: "Check your input (at least one internal domain is required).",
  },
}
