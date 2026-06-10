/**
 * The configuration shape.
 *
 * This add-in keeps its config in code, not in a settings pane.
 * For an organization, shipping one config file is simpler to
 * deploy and review than a per-user UI. Fork defaults.ts to change
 * behavior.
 */

import { z } from "zod"

import { supportedLocales } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"

/** All settings the add-in reads at send time. */
export interface Config {
  /** Domains treated as internal, for example ["example.com"]. */
  readonly internalDomains: readonly string[]
  /** Seconds to count down before the send button turns on. */
  readonly sendDelaySeconds: number
  /** Require a per-recipient check for every recipient across To/Cc/Bcc. */
  readonly requireRecipientConfirmation: boolean
  /** Require a check that attachments were reviewed. */
  readonly requireAttachmentConfirmation: boolean
  /** Require a check that the body was reviewed. */
  readonly requireBodyConfirmation: boolean
  /** Words that hint the body refers to an attachment. */
  readonly attachmentKeywords: readonly string[]
  /** Warn when the subject is empty. */
  readonly warnOnEmptySubject: boolean
  /** Locale used when the host language is unknown. */
  readonly fallbackLocale: LocaleTag
  /** Dialog size and rendering options. */
  readonly dialog: {
    /** Dialog width as a percent of the screen. */
    readonly widthPercent: number
    /** Dialog height as a percent of the screen. */
    readonly heightPercent: number
    /**
     * Render inside an iframe instead of a new window.
     *
     * New Outlook and Outlook on the web use the browser runtime,
     * so this is usually false. Set true only for the legacy
     * classic web runtime if you target it.
     */
    readonly displayInIframe: boolean
  }
}

/**
 * Runtime schema for {@link Config}.
 *
 * The config ships as code and is forked per organization, so a bad
 * value — a percent over 100, a negative delay, an unknown locale — is
 * a deployment mistake, not something the type system can catch.
 * `defaults.ts` parses through this, so a broken fork fails loudly at
 * load time instead of misbehaving at send time.
 *
 * Assigning `configSchema.parse(...)` to a `Config` (in defaults.ts) is
 * itself the drift guard: if the schema drops a field or changes a
 * type, that assignment stops compiling.
 */
export const configSchema = z.object({
  internalDomains: z.array(z.string().min(1)).min(1),
  sendDelaySeconds: z.number().int().min(0),
  requireRecipientConfirmation: z.boolean(),
  requireAttachmentConfirmation: z.boolean(),
  requireBodyConfirmation: z.boolean(),
  attachmentKeywords: z.array(z.string().min(1)),
  warnOnEmptySubject: z.boolean(),
  fallbackLocale: z.enum(supportedLocales as [LocaleTag, ...LocaleTag[]]),
  dialog: z.object({
    widthPercent: z.number().gt(0).max(100),
    heightPercent: z.number().gt(0).max(100),
    displayInIframe: z.boolean(),
  }),
})
