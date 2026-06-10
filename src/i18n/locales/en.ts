import type { Messages } from "../types"

/** English messages. */
export const en: Messages = {
  dialog: {
    title: "Confirm before sending",
    intro: "Check the recipients, attachments, and body before you send.",
    sendNow: "Send now",
    backToEdit: "Back to draft",
    cancelSend: "Cancel",
    sendingInSeconds: seconds => `Sending in ${seconds}s…`,
    delayLabel: "Wait before sending",
    delayValue: seconds => {
      if (seconds <= 0) {
        return "No delay"
      }
      if (seconds < 60) {
        return `${seconds}s`
      }
      const minutes = Math.floor(seconds / 60)
      const rest = seconds % 60
      return rest === 0 ? `${minutes} min` : `${minutes} min ${rest}s`
    },
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
    confirmHint: "Check each recipient before sending.",
    none: "No recipients",
  },
  attachments: {
    none: "No attachments",
    confirmHint: "Check each attachment before sending.",
  },
  body: {
    confirm: "I checked the body",
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
    sendAgain: "Open the review pane and check the required items. Then press Send again.",
    warnings: "Warnings",
    moreItems: count => `${count} more`,
    openReview: "Open review",
  },
  taskPane: {
    title: "Confirm before sending",
    intro: "Check the required items. After confirming, press Outlook's Send button again.",
    confirm: "Mark as reviewed",
    confirmed: "Reviewed. Press Outlook's Send button again.",
    loadFailed: "The review pane could not load. Return to your draft and review it.",
  },
  cancel: {
    notSent: "The message was not sent. Return to your draft to review it.",
    returnLabel: "Back to draft",
  },
}
