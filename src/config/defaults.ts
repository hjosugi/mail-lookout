import type { Config } from "./types"

/**
 * The default configuration.
 *
 * This is the single place to configure the add-in. Fork this
 * file for your organization. Keeping config in code keeps
 * deployment simple: ship one file, no per-user setup.
 *
 * Replace "example.com" with your own internal domains before you
 * deploy. If the list is wrong, every recipient looks external.
 */
export const defaultConfig: Config = {
  internalDomains: ["example.com"],
  sendDelaySeconds: 180,
  requireRecipientConfirmation: true,
  requireAttachmentConfirmation: true,
  requireBodyConfirmation: true,
  attachmentKeywords: [
    "添付",
    "別添",
    "添付ファイル",
    "attach",
    "attached",
    "attachment",
    "enclosed",
    "see attached",
  ],
  warnOnEmptySubject: true,
  fallbackLocale: "en",
  dialog: {
    widthPercent: 32,
    heightPercent: 60,
    displayInIframe: false,
  },
}
