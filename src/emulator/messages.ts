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
    readonly accepted: string
    readonly cancelled: string
    readonly backToDraft: string
    readonly openingSentStub: string
  }
  /** The draft summary card. */
  readonly draft: {
    readonly noSubject: string
    readonly summary: (recipients: number, attachments: number) => string
  }
  /** The post-send corner toast. */
  readonly toast: {
    /** Countdown line; the value is a pre-formatted "M:SS" or "Ns". */
    readonly sendingIn: (remaining: string) => string
    readonly details: string
    readonly accepted: string
    readonly openSent: string
    readonly cancelled: string
  }
}

const en: EmulatorMessages = {
  status: {
    ready: "Ready.",
    reviewing: "Reviewing draft.",
    accepted: "Send accepted.",
    cancelled: "Send cancelled. Back to draft.",
    backToDraft: "Back to draft selected.",
    openingSentStub: "Opening the sent message (stub in the emulator).",
  },
  draft: {
    noSubject: "(No subject)",
    summary: (recipients, attachments) => `${recipients} recipients, ${attachments} attachments`,
  },
  toast: {
    sendingIn: remaining => `Sending in ${remaining}`,
    details: "Details",
    accepted: "Send accepted",
    openSent: "Open sent mail",
    cancelled: "Send cancelled",
  },
}

const ja: EmulatorMessages = {
  status: {
    ready: "準備完了。",
    reviewing: "確認中です。",
    accepted: "送信を受け付けました。",
    cancelled: "送信をキャンセルしました。下書きに戻ります。",
    backToDraft: "編集に戻る判定です。",
    openingSentStub: "送信済みメールを開きます(エミュレータではスタブ)。",
  },
  draft: {
    noSubject: "(件名なし)",
    summary: (recipients, attachments) => `宛先 ${recipients} 件、添付 ${attachments} 件`,
  },
  toast: {
    sendingIn: remaining => `あと ${remaining} で送信します`,
    details: "詳細",
    accepted: "送信を受け付けました",
    openSent: "送信済みを開く",
    cancelled: "送信をキャンセルしました",
  },
}

// Keyed by the product's LocaleTag, so adding a language to the add-in
// forces an emulator translation here too (or the build fails).
const emulatorLocales = { en, ja } satisfies Record<LocaleTag, EmulatorMessages>

/** Get the emulator's strings for a locale. */
export function getEmulatorMessages(locale: LocaleTag): EmulatorMessages {
  return emulatorLocales[locale]
}
