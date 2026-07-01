import { configSchema, type Config } from "./types"

/**
 * The default configuration.
 *
 * This is the single place to configure the add-in. Fork this
 * file for your organization. Keeping config in code keeps
 * deployment simple: ship one file, no per-user setup.
 *
 * Keep this list aligned with the publisher/company domain. If the
 * list is wrong, every recipient looks external.
 */
export const defaultConfig: Config = configSchema.parse({
  internalDomains: ["avishaikofun.com"],
  sendDelaySeconds: 60,
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
    displayInIframe: true,
  },
})
