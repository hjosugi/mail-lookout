import type { LocaleTag } from "../i18n/catalog"

/**
 * UI strings for the local emulator (the dev harness).
 *
 * These are kept separate from the add-in's own `Messages` contract:
 * they belong to the emulator, not the shipped product, so they should
 * not pollute it. The shape mirrors the product i18n on purpose, so
 * anyone extending the emulator has one obvious place to add strings,
 * and adding a language is the same compiler-checked exercise.
 */
export interface EmulatorMessages {
  /** Lines shown in the result panel's status area. */
  readonly status: {
    readonly ready: string
    readonly reviewing: string
  }
  /** The draft summary card. */
  readonly draft: {
    readonly label: string
    readonly noSubject: string
    readonly summary: (recipients: number, attachments: number) => string
  }
  /**
   * The mini countdown shown in the result panel after the review is
   * confirmed — the emulator's stand-in for the Outlook task pane that
   * counts down and then sends with item.sendAsync.
   */
  readonly mini: {
    /** Countdown line; the value is a pre-formatted "M:SS" or "Ns". */
    readonly holding: (remaining: string) => string
    readonly sent: string
    readonly cancel: string
    readonly backToReview: string
  }
}

const en: EmulatorMessages = {
  status: {
    ready: "Ready.",
    reviewing: "Reviewing draft.",
  },
  draft: {
    label: "Current draft",
    noSubject: "(No subject)",
    summary: (recipients, attachments) => `${recipients} recipients, ${attachments} attachments`,
  },
  mini: {
    holding: remaining => `Waiting to send… ${remaining}`,
    sent: "Sent.",
    cancel: "Cancel",
    backToReview: "Back to review",
  },
}

const ja: EmulatorMessages = {
  status: {
    ready: "準備完了。",
    reviewing: "確認中です。",
  },
  draft: {
    label: "現在の下書き",
    noSubject: "(件名なし)",
    summary: (recipients, attachments) => `宛先 ${recipients} 件、添付 ${attachments} 件`,
  },
  mini: {
    holding: remaining => `送信待機中… ${remaining}`,
    sent: "送信しました。",
    cancel: "キャンセル",
    backToReview: "確認に戻る",
  },
}

// Keyed by the product's LocaleTag, so adding a language to the add-in
// forces an emulator translation here too (or the build fails).
const emulatorLocales = { en, ja } satisfies Record<LocaleTag, EmulatorMessages>

/** Get the emulator's strings for a locale. */
export function getEmulatorMessages(locale: LocaleTag): EmulatorMessages {
  return emulatorLocales[locale]
}
