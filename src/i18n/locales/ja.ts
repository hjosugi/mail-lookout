import type { Messages } from "../types"

/** Japanese messages. */
export const ja: Messages = {
  dialog: {
    title: "送信前の確認",
    intro: "送信前に、宛先・添付・本文を確認してください。",
    sendNow: "今すぐ送信",
    backToEdit: "編集に戻る",
    cancelSend: "キャンセル",
    sendingInSeconds: seconds => `${seconds} 秒後に送信…`,
    delayLabel: "送信までの待ち時間",
    delayValue: seconds => {
      if (seconds <= 0) {
        return "遅延なし"
      }
      if (seconds < 60) {
        return `${seconds}秒`
      }
      const minutes = Math.floor(seconds / 60)
      const rest = seconds % 60
      return rest === 0 ? `${minutes}分` : `${minutes}分${rest}秒`
    },
    delayUnitMinutes: "分",
    delayImmediateHint: "0 で即時送信",
  },
  sections: {
    recipients: "宛先",
    attachments: "添付ファイル",
    subject: "件名",
    body: "本文",
  },
  fields: {
    to: "宛先",
    cc: "CC",
    bcc: "BCC",
  },
  recipients: {
    externalBadge: "社外",
    internalBadge: "社内",
    confirmHint: "宛先を確認してチェックしてください。",
    none: "宛先がありません",
  },
  attachments: {
    none: "添付ファイルはありません",
    confirmHint: "添付ファイルを確認してチェックしてください。",
  },
  body: {
    confirm: "本文を確認しました",
    empty: "(本文がありません)",
  },
  subject: {
    empty: "(件名なし)",
    confirmEmpty: "件名なしで送信する",
  },
  warnings: {
    emptySubject: "件名が空です。",
    forgottenAttachment: "本文は添付ファイルの記載がありますが、ファイルが添付されていません。",
    externalRecipients: count => `社外の宛先が ${count} 件あります。`,
  },
  cancel: {
    notSent: "メールは送信していません。下書きに戻って内容を確認してください。",
    returnLabel: "下書きに戻る",
  },
}
