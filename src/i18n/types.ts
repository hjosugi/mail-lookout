/**
 * The message contract.
 *
 * Every locale must implement this interface in full. Some
 * entries are functions because they interpolate a value, like a
 * count or a number of seconds.
 *
 * To add a language, create a new file in locales/ that exports a
 * `Messages` object, then register it in catalog.ts. The compiler
 * will tell you if you miss a key.
 */
export interface Messages {
  readonly dialog: {
    readonly title: string
    readonly intro: string
    readonly sendNow: string
    readonly backToEdit: string
    readonly cancelSend: string
    readonly sendingInSeconds: (seconds: number) => string
    /** Label for the send-delay control shown in the dialog. */
    readonly delayLabel: string
    /** Unit shown next to the minutes delay input, e.g. "min" or "分". */
    readonly delayUnitMinutes: string
    /** Hint that entering 0 sends immediately. */
    readonly delayImmediateHint: string
  }
  readonly sections: {
    readonly recipients: string
    readonly attachments: string
    readonly subject: string
    readonly body: string
  }
  readonly fields: {
    readonly to: string
    readonly cc: string
    readonly bcc: string
  }
  readonly recipients: {
    readonly externalBadge: string
    readonly internalBadge: string
    readonly confirmHint: string
    readonly none: string
  }
  readonly attachments: {
    readonly none: string
    readonly confirmHint: string
  }
  readonly body: {
    readonly confirm: string
    readonly empty: string
  }
  readonly subject: {
    readonly empty: string
    readonly confirmEmpty: string
  }
  readonly warnings: {
    readonly emptySubject: string
    readonly forgottenAttachment: string
    readonly externalRecipients: (count: number) => string
  }
  readonly smartAlert: {
    /** One-line prompt in the built-in dialog: open the review and check items. */
    readonly prompt: string
    /** Shown in the built-in dialog while a send countdown is already running. */
    readonly waiting: string
    /** Action button: open the review pane. */
    readonly openReview: string
    /** Action button when a countdown is running: open the status pane. */
    readonly showWaiting: string
  }
  readonly taskPane: {
    readonly title: string
    readonly intro: string
    readonly confirm: string
    /** Shown while the post-confirm countdown is running. */
    readonly holding: string
    /** Shown when the add-in programmatically sends the item. */
    readonly sending: string
    /** Shown when the programmatic send fails. */
    readonly sendFailed: string
    readonly loadFailed: string
  }
  readonly cancel: {
    readonly notSent: string
    readonly returnLabel: string
  }
}
