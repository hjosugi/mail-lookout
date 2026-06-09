# mail-lookout

新しい Outlook と Outlook on the web 向けの送信確認アドインです。

送信ボタンを押したときに動きます。宛先・添付ファイル・本文プレビュー
を表示するダイアログが開きます。必要な項目を確認し、短いディレイを
待ってから送信します。目的は小さなミスを防ぐことです。宛先の間違い、
添付の付け忘れ、件名の空欄、といったものです。

名前の「mail-lookout」は「送信お願い」から来ています。

> 英語版: [README.md](./README.md)

## 機能

このアドインは送信時に 4 つのことを行います。

1. **宛先確認。** すべての宛先をフィールド別（To / Cc / Bcc）に
   一覧表示し、社外の宛先には印を付けます。宛先を 1 件ずつ
   確認させます。
2. **添付ファイル確認。** 実体のある添付をすべて一覧表示し、ファイル
   を 1 つずつ確認させます。
3. **本文確認。** 本文のプレビューを表示し、確認したことをチェック
   させます。
4. **送信ディレイ。** 送信ボタンが有効になるまで数秒カウントダウン
   します。これは考えるための間であり、予約送信ではありません。

加えて 2 つの軽い警告を出します。

- **件名が空。** 件名が空のときに警告します。
- **添付の付け忘れ。** 本文が添付に言及している（「添付」「see
  attached」など）のにファイルが添付されていないとき警告します。

設定タスクペインはありません。すべての挙動は 1 つの設定ファイル
[`src/config/defaults.ts`](./src/config/defaults.ts) にあります。
組織にとっては、ユーザーごとの UI よりも、1 つの設定ファイルを
配布するほうが導入もレビューも簡単です。

## 動作要件

- 新しい Outlook（Windows）または Outlook on the web。
- Mailbox requirement set 1.15 以降。
- 開発には Node.js 22.12 以降。

このアドインは Outlook モバイルでは動きません。クラシック Outlook
については「制限事項」を参照してください。

## アーキテクチャ

ロジックが Office に依存しないようにコードを分けています。

```
src/
  domain/    純粋なロジック。Office も DOM も時刻も使わない。全テスト済み。
  config/    設定の型とデフォルト値。
  i18n/      型安全なメッセージ。1 言語につき 1 ファイル。
  shared/    ハンドラとダイアログ間のメッセージプロトコル。
  office/    Office アダプタ。下書きを読み、ハンドラを動かす。
  commands/  送信ハンドラを Office に登録する。
  dialog/    ブラウザ上で確認ダイアログを描画する。
```

`domain` 層が中核です。メッセージのプレーンなスナップショットと
設定を受け取り、フラットで JSON 化できるモデルを返します。何を表示し
何を必須にするかをここで決めます。ホストの API に一切触れないため、
すべてのルールをプレーンなデータでテストできます。価値はテストに
あります。

`office` 層は薄いアダプタです。Office API で下書きを読み、プレーンな
スナップショットを `domain` に渡し、ダイアログを開き、送信を許可
または中止します。中核層は Office を一切 import しないので、この分離は
構造として保たれます。新しいホスト呼び出しは `office` 層に置いて
ください。

## セットアップ

```sh
# 1. 依存関係をインストールする。
npm install

# 2. ローカルの HTTPS 証明書を信頼する。Outlook は HTTPS を要求する。
npm run dev-certs

# 3. https://localhost:3000 で開発サーバーを起動する。
npm run dev:outlook
```

そのあと Outlook に `manifest.xml` をサイドロードします。手順は
ホストによって異なります。

- **Outlook on the web:** 設定を開き、アドインのページで「カスタム
  アドインを追加」→「ファイルから追加」を選び、`manifest.xml` を
  指定します。
- **新しい Outlook（Windows）:** 同じアカウントの Outlook on the web
  から、同じアドイン管理ページを使います。

サイドロード後、新規メールを開き、宛先を入れて送信を押します。
確認ダイアログが表示されるはずです。

### Outlook なしのローカル emulator

Outlook を使わず、ブラウザだけで確認フローを試せます。

```sh
npm install
npm run dev:emulator
```

または通常の開発サーバーを起動して
Vite が表示する URL の `/emulator.html` を開きます。3000 番ポートが
使われている場合、Vite は例えば `https://localhost:3001/emulator.html`
のように次の空きポートを使います。この emulator は Outlook の API や
Office.js を使わず、実際のドメインロジックとダイアログ renderer を
そのまま使います。下書き欄やシナリオを変更し、「Review send」を押すと
確認ダイアログを再生成できます。

Outlook にサイドロードして試す場合は `npm run dev:outlook` を使います。
`manifest.xml` は `https://localhost:3000` 固定なので、この script は
3000 番ポートが使われていると意図的に失敗します。

## コードを検証する

```sh
npm run check
```

これは順に、Biome（フォーマットと lint）・両 tsconfig の型チェック・
カバレッジ付きテスト・本番ビルド・マニフェスト検証を実行します。
各ステップが通る必要があります。個別のステップ:

```sh
npm run typecheck      # src と build 設定への tsc
npm run lint           # biome lint
npm run format         # biome format --write
npm run test           # vitest を 1 回実行
npm run test:coverage  # 純粋層へのカバレッジ付き vitest
npm run build          # tsc --noEmit のあと vite build
npm run validate       # office-addin-manifest validate
```

## 本番デプロイ

マニフェストはプレースホルダ値で出荷されます。デプロイ前に置き換えて
ください。

1. **GUID。** `manifest.xml` の `<Id>` を自分の GUID に置き換える。
2. **URL。** `manifest.xml` 内のすべての `https://localhost:3000`
   を自分のホストに置き換える。`npm run build` でビルドし、`dist/`
   フォルダをそのホストの HTTPS で配信する。エントリ JS は安定した
   名前（`/assets/commands.js`）を保つため、ビルドごとにマニフェスト
   の URL は変わらない。
3. **社内ドメイン。** `src/config/defaults.ts` の `internalDomains`
   を編集する。このリストが間違っていると、すべての宛先が社外に
   見える。
4. **メタデータ。** `manifest.xml` の `ProviderName`・`SupportUrl`・
   `AppDomains` を置き換える。

そのうえで、組織向けに Microsoft 365 管理センターから公開するか、
個人向けにサイドロードします。

## 設定

すべての設定は [`src/config/defaults.ts`](./src/config/defaults.ts)
にあります。このファイルをフォークしてください。主なオプション:

- `internalDomains`: 社内として扱うドメイン。
- `sendDelaySeconds`: 送信が有効になるまでのカウントダウン秒数。
  `0` で無効。
- `requireRecipientConfirmation`: 宛先を 1 件ずつ確認させる。
- `requireAttachmentConfirmation`: 添付ファイルを 1 つずつ確認
  させる。
- `requireBodyConfirmation`: 本文を確認したことをチェックさせる。
- `attachmentKeywords`: 本文が添付に言及しているか判定する語。
  添付付け忘れ警告で使う。
- `warnOnEmptySubject`: 件名が空のとき警告する。
- `fallbackLocale`: ホストの言語が不明なときに使う言語。
- `dialog`: ダイアログの幅と高さ（画面に対する割合）。

## 言語を追加する

メッセージは型安全です。言語を追加するには:

1. `src/i18n/locales/en.ts` を新しいファイル（例 `de.ts`）に
   コピーし、すべての値を翻訳する。
2. `src/i18n/catalog.ts` に 1 行追加する。import して `locales`
   オブジェクトに加えるだけ。

キーが足りなければコンパイラが教えてくれます。`test/i18n.test.ts`
のテストも、すべてのロケールが同じキー集合を持つことを確認します。
それ以外に変更は不要です。ロケールタグの型は `locales` のキーから
自動で更新されます。

## SendMode: SoftBlock と PromptUser

マニフェストは `SendMode="SoftBlock"` を使います。SoftBlock では、
アドインが送信を中止したとき、ユーザーは下書きに戻って編集する必要
があります。ワンクリックの「とにかく送信」はありません。これは意図
的です。すべての中止がワンクリックで回避できる確認ツールは、ほとんど
確認になりません。

より緩いツールがよければ、`manifest.xml` の `SendMode` を
`PromptUser` に変えてください。すると中止のたびに「とにかく送信」
ボタンが出ます。引き換えに、ユーザーは確認せずにクリックで通り抜け
られます。

ハンドラは 1 つの場合だけ配慮します。リッチなダイアログがそもそも
開けないとき、ハンドラはユーザーを閉じ込めません。ホスト内蔵の
プロンプトにフォールバックし、その経路に限り `PromptUser` を使います。
アドインの不具合が本物のメールを止めることがないようにするためです。
予期しないエラーが起きた場合、ハンドラは送信を許可します。

## 制限事項

これが何で、何でないかを正直に書きます。

- **送信ディレイはダイアログのカウントダウンであり、予約送信では
  ない。** ダイアログが開いている間、数秒ボタンが無効になるだけです。
  メールがサーバーに保留されて後で送られるわけではありません。
  送信を押せば、送られます。
- **「処理中」の通知が出ることがある。** 送信ハンドラが 5 秒を超えて
  動くと、Outlook は独自の通知を出します。このアドインは確認
  ダイアログを開いてユーザーを待つため、その通知が出ることが
  あります。これはホストの一部で、消せません。
- **クラシック Outlook（Windows）は対象外。** そのホストは送信
  ハンドラに JavaScript 専用ランタイムを使います。本プロジェクトは
  HTML ページ経由で読み込む ES モジュールをビルドします。これは
  新しい Outlook と Outlook on the web が使うブラウザランタイム
  向けです。マニフェストはスキーマ上の理由で JS 専用オーバーライドを
  宣言しますが、クラシック経路はサポートもテストもしていません。
- **Outlook モバイルは非対応。** 送信時の Smart Alerts はそこでは
  動きません。

### OutlookOkan との関係

[OutlookOkan](https://github.com/0xww/OutlookOkan) はクラシック
Outlook 向けの有名な送信確認ツールです。デスクトップアプリを直接
フックする VSTO/COM アドインです。その仕組みは、Web 技術で作られた
別アプリである新しい Outlook では**動きません**。本アドインのような
Web の Office アドインが、新しい Outlook に送信時チェックを足す
ための、サポートされた方法です。2 つのツールは、異なるホストで
同じ問題を解いています。

## 統合マニフェストへの移行

本プロジェクトはアドイン専用マニフェスト（`manifest.xml`）で出荷
します。これは現在、Outlook on the web と新しい Outlook で十分に
サポートされています。Microsoft 365 の統合マニフェストはより新しい
形式で、Microsoft が進んでいる方向です。必要なら、
`office-addin-manifest` ツールで XML マニフェストを統合形式に変換
できます。本プロジェクトのランタイムコードは変わりません。変わるのは
マニフェストだけです。

## ライセンス

[MIT](./LICENSE)
