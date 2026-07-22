# Microsoft Marketplace resubmission

Product ID: `9fdc0ebf-bcce-472e-972f-95e0ea8ca78b`

This file contains the text to copy into Partner Center. Updating this file does not update the
Marketplace listing by itself.

## Certification findings addressed

- **1100.1.5 First Run Experience:** version 1.1.13 shows a one-time, localized welcome screen
  before either Outlook task pane is used. It explains the value of the add-in, the review flow,
  the data it reads, the scheduled-send limitation, and links to the privacy policy and terms.
- **1120.4.20 EventBasedLaunch - Disclaimer:** add the disclosure below to every Marketplace
  listing language. It states which event launches the add-in and what the handler does.

## English long description

Copy the complete text below into the English **Description** field.

```text
Mail Lookout helps prevent common email mistakes before a message leaves your Outlook draft. It highlights external recipients and gives you a checklist for recipients, attachments, subject, and body. After the checklist is complete, a cancellable countdown gives you one more chance to stop the send.

No account or sign-in is required.

How it works

1. Compose a message in Outlook.
2. Select Send.
3. Mail Lookout opens Outlook's Smart Alerts prompt when the message needs review.
4. Open the review, check each required item, and select Send.
5. Keep the review pane open until the countdown completes, or cancel to return to the checklist.

EventBasedLaunch Disclaimer

This offer enables Outlook LaunchEvents functionality. Mail Lookout uses the OnMessageSend event and starts automatically when the user selects Send. It reads the recipients, attachment metadata, subject, and body of the current draft to build the review. When review is required, it stops the first send attempt and asks the user to open the review pane. It does not run this review for Scheduled Send / Send later messages.

Smart Alerts Disclaimer

This offer enables Outlook Smart Alerts functionality in SoftBlock mode. Smart Alerts displays an Outlook-provided prompt when a message needs review. The user can return to the draft or open Mail Lookout's review pane. Mail Lookout does not send the message until the required review is complete.

Privacy

The review runs inside the Outlook add-in. Mail Lookout does not send draft content, recipients, attachment metadata, or review results to a separate Mail Lookout server. See the linked privacy policy for details.

Requirements

- New Outlook on Windows or Outlook on the web
- Mailbox requirement set 1.15 or later
- An internet connection when the event handler starts

Scheduled Send / Send later and Outlook mobile are not supported.
```

## Japanese long description

Copy the complete text below into the Japanese **説明** field if a Japanese listing is present.

```text
Mail Lookoutは、Outlookのメールを送信する前に、よくあるミスを防ぐためのアドインです。社外の宛先を強調し、宛先・添付ファイル・件名・本文をチェックリストで確認できます。すべて確認したあとも、キャンセル可能なカウントダウン中に送信を止められます。

アカウント登録やサインインは不要です。

使い方

1. Outlookでメールを作成します。
2. 送信ボタンを押します。
3. 確認が必要な場合、Mail LookoutがOutlook標準のSmart Alertsを表示します。
4. 確認画面を開き、必要な項目をチェックして「送信する」を押します。
5. カウントダウンが終わるまで確認ペインを開いたままにするか、キャンセルして確認に戻ります。

EventBasedLaunchに関する説明

このアドインはOutlookのLaunchEvents機能を使用します。Mail LookoutはOnMessageSendイベントを使用し、ユーザーが送信ボタンを押したときに自動起動します。確認画面を作成するため、編集中の下書きの宛先、添付情報、件名、本文を読み取ります。確認が必要な場合は最初の送信を止め、確認ペインを開くよう求めます。予約送信／後で送信するメールには、この確認処理を行いません。

Smart Alertsに関する説明

このアドインはOutlookのSmart Alerts機能をSoftBlockモードで使用します。確認が必要な場合、Smart AlertsがOutlook標準のメッセージを表示します。ユーザーは下書きへ戻るか、Mail Lookoutの確認ペインを開けます。必要な確認が終わるまでMail Lookoutはメールを送信しません。

プライバシー

確認処理はOutlookアドイン内で行われます。下書き内容、宛先、添付情報、確認結果をMail Lookout専用サーバーへ送信しません。詳しくはリンク先のプライバシーポリシーをご覧ください。

動作要件

- 新しいOutlook（Windows）またはOutlook on the web
- Mailbox requirement set 1.15以降
- イベントハンドラ起動時のインターネット接続

予約送信／後で送信、およびOutlookモバイルには対応していません。
```

## Notes for certification

Copy this into **Notes for certification**.

```text
This resubmission addresses findings 1100.1.5 and 1120.4.20.

First-run experience:
- Open either Mail Lookout ribbon command (Open review or Settings).
- On a clean installation, a localized Welcome to Mail Lookout screen appears before the task pane.
- The screen explains the value proposition, automatic OnMessageSend LaunchEvent, Smart Alerts behavior, data used, Scheduled Send limitation, privacy behavior, and links to the Privacy Policy and Terms of Use.
- Select Get started to continue. Completion is saved in Outlook roaming settings with browser storage as a fallback.

Send-flow validation:
1. Use new Outlook on Windows or Outlook on the web and create a standard new message.
2. Add a recipient and select Send.
3. Smart Alerts blocks the first attempt in SoftBlock mode. Select Open review.
4. Check every required item and select Send.
5. Keep the pane open until the countdown finishes. The message is then sent.

No external account or sign-in is required. Scheduled Send / Send later is intentionally passed through without Mail Lookout review.
```

## Resubmission checklist

1. Deploy the version 1.1.13 build to `https://avishaikofun.com`.
2. Run `bun run check:publish` and confirm the public manifest reports version `1.1.13.0`.
3. Upload the version `1.1.13.0` production manifest/package.
4. Replace the English description with the full English text above.
5. Replace the Japanese description too, if that listing exists.
6. Paste the certification notes above.
7. Confirm the privacy, terms, and support URLs are still public, then resubmit.

References:

- [Microsoft Marketplace certification policies](https://learn.microsoft.com/legal/marketplace/certification-policies)
- [First-run experience tutorial](https://learn.microsoft.com/office/dev/add-ins/tutorials/first-run-experience-tutorial)
- [Activate add-ins with events](https://learn.microsoft.com/office/dev/add-ins/develop/event-based-activation)
- [Marketplace listing options for event-based add-ins](https://learn.microsoft.com/office/dev/add-ins/publish/autolaunch-store-options)
