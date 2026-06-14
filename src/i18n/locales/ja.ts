import type { Messages } from "../types"

/** Japanese messages. */
export const ja: Messages = {
  dialog: {
    title: "送信前の確認",
    intro: "送信前に、宛先・添付・本文を確認してください。",
    sendNow: "今すぐ送信する",
    backToEdit: "編集に戻る",
    cancelSend: "キャンセル",
    sendingInSeconds: seconds => `${seconds}秒後に送信…`,
    delayLabel: "送信待ち時間",
    delayUnitMinutes: "分",
    delayImmediateHint: "0で即時送信。0.1分単位で入力できます。",
  },
  sections: {
    recipients: "宛先",
    attachments: "添付ファイル",
    subject: "件名",
    body: "本文",
  },
  fields: {
    to: "To",
    cc: "CC",
    bcc: "BCC",
  },
  recipients: {
    externalBadge: "社外",
    internalBadge: "社内",
    confirmHint: "各宛先を確認してください。",
    none: "宛先がありません",
  },
  attachments: {
    none: "添付ファイルはありません",
    confirmHint: "各添付ファイルを確認してください。",
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
    externalRecipients: count => `社外の宛先が${count}件あります。`,
  },
  smartAlert: {
    prompt: "必要な項目を確認してください。",
    waiting: "送信待機中です。",
    openReview: "確認画面を開く",
    showWaiting: "待機画面を開く",
    action: label => `「${label}」を押してください。`,
  },
  taskPane: {
    title: "送信前の確認",
    intro: "",
    confirm: "送信する",
    holding: "送信待機中です…",
    sending: "送信しています…",
    sendFailed: "送信できませんでした。もう一度お試しください。",
    loadFailed: "確認画面を読み込めませんでした。下書きに戻って内容を確認してください。",
  },
  waiting: {
    othersTitle: "他に送信待機中",
    settingsTitle: "送信待機中のメール",
    empty: "送信待機中のメールはありません。",
    recipients: count => `宛先${count}件`,
    remaining: text => `残り${text}`,
    capReached: max => `送信待機が上限（${max}件）に達しました。1件送信されるまでお待ちください。`,
    retry: "再試行",
    keepOpen: "送信待機中です。ページの更新または閉じる場合、メールの送信はキャンセルされます。",
    unloadWarning:
      "送信待機中です。ページの更新または閉じる場合、メールの送信はキャンセルされます。よろしいですか？",
  },
  cancel: {
    notSent: "メールは送信していません。下書きに戻って内容を確認してください。",
    returnLabel: "下書きに戻る",
  },
  settings: {
    title: "設定",
    intro: "この端末でのみ有効な設定です。",
    domainsLabel: "社内ドメイン",
    domainsHint: "1行に1つ。ここに無いドメインの宛先は「社外」として扱います。",
    delayLabel: "デフォルトの待ち時間",
    delayHint: "「確認して送信する」後のカウントダウンの初期値です。0.1分単位で入力できます。",
    delayUnit: "分",
    save: "保存",
    saved: "保存しました。",
    reset: "既定に戻す",
    invalid: "入力を確認してください（社内ドメインは1つ以上必要です）。",
  },
}
