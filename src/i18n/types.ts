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
    readonly sendInSeconds: (seconds: number) => string
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
  readonly warnings: {
    readonly emptySubject: string
    readonly forgottenAttachment: string
    readonly externalRecipients: (count: number) => string
  }
  /**
   * Text used by the built-in fallback prompt.
   *
   * The fallback runs when the rich dialog cannot open. It uses
   * the host's own notification, so it is plain text only.
   */
  readonly fallback: {
    readonly title: string
    readonly externalLine: (count: number) => string
    readonly forgottenAttachmentLine: string
    readonly emptySubjectLine: string
    readonly reviewLine: string
  }
  readonly cancel: {
    readonly notSent: string
    readonly returnLabel: string
  }
}
