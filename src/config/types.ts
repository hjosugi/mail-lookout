/**
 * The configuration shape.
 *
 * This add-in keeps its config in code, not in a settings pane.
 * For an organization, shipping one config file is simpler to
 * deploy and review than a per-user UI. Fork defaults.ts to change
 * behavior.
 */

import type { LocaleTag } from "../i18n/catalog";

/** All settings the add-in reads at send time. */
export interface Config {
  /** Domains treated as internal, for example ["example.com"]. */
  readonly internalDomains: readonly string[];
  /** Seconds to count down before the send button turns on. */
  readonly sendDelaySeconds: number;
  /** Require a per-address check for each external recipient. */
  readonly requireExternalRecipientConfirmation: boolean;
  /** Require a check that attachments were reviewed. */
  readonly requireAttachmentConfirmation: boolean;
  /** Require a check that the body was reviewed. */
  readonly requireBodyConfirmation: boolean;
  /** Words that hint the body refers to an attachment. */
  readonly attachmentKeywords: readonly string[];
  /** Warn when the subject is empty. */
  readonly warnOnEmptySubject: boolean;
  /** Locale used when the host language is unknown. */
  readonly fallbackLocale: LocaleTag;
  /** Dialog size and rendering options. */
  readonly dialog: {
    /** Dialog width as a percent of the screen. */
    readonly widthPercent: number;
    /** Dialog height as a percent of the screen. */
    readonly heightPercent: number;
    /**
     * Render inside an iframe instead of a new window.
     *
     * New Outlook and Outlook on the web use the browser runtime,
     * so this is usually false. Set true only for the legacy
     * classic web runtime if you target it.
     */
    readonly displayInIframe: boolean;
  };
}
