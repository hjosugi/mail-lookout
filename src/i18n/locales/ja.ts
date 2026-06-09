import type { Messages } from "../types"

/** Japanese messages. */
export const ja: Messages = {
  dialog: {
    title: "送信前の確認",
    intro: "送信する前に、宛先・添付・本文を確認してください。",
    sendNow: "今すぐ送信",
    backToEdit: "編集に戻る",
    sendInSeconds: (seconds) => `送信まで ${seconds} 秒`,
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
    confirmHint: "宛先を1人ずつ確認してチェックしてください。",
    none: "宛先がありません",
  },
  attachments: {
    none: "添付ファイルはありません",
    confirmHint: "添付ファイルを1つずつ確認してチェックしてください。",
  },
  body: {
    confirm: "本文を確認しました",
    empty: "(本文がありません)",
  },
  warnings: {
    emptySubject: "件名が空です。",
    forgottenAttachment: "本文は添付ファイルに触れていますが、ファイルが添付されていません。",
    externalRecipients: (count) => `社外の宛先が ${count} 件あります。`,
  },
  fallback: {
    title: "送信前の確認",
    externalLine: (count) => `社外の宛先が ${count} 件あります。`,
    forgottenAttachmentLine: "本文は添付ファイルに触れていますが、ファイルが添付されていません。",
    emptySubjectLine: "件名が空です。",
    reviewLine: "宛先と内容を確認してから送信してください。",
  },
  cancel: {
    notSent: "メールは送信していません。下書きに戻って内容を確認してください。",
    returnLabel: "下書きに戻る",
  },
}
