# mail-lookout

新しい Outlook と Outlook on the web 向けの送信確認アドインです。

送信ボタンを押したときに動きます。Outlook 標準の Smart Alerts
ダイアログから、宛先・添付ファイル・件名・本文をチェックできる確認
ペインを開きます。必要な項目をチェックしたあと、もう一度送信します。
目的は小さなミスを防ぐことです。宛先の間違い、添付の付け忘れ、件名の
空欄、といったものです。

名前はそのままの意味で、送信メールの見張り役です。メッセージが
出ていく前に問題を知らせます。

> 英語版: [README.md](./README.md)

## 機能

このアドインは送信時に 4 つのことを行います。

1. **宛先確認。** すべての宛先をフィールド別（To / Cc / Bcc）に
   一覧表示し、社外の宛先には印を付けます。
2. **添付ファイル確認。** 実体のある添付をすべて一覧表示し、ファイル
   を確認できるようにします。
3. **本文確認。** 本文のプレビューを表示します。
4. **確認ペインで確認完了。** 1 回目の送信を止め、task pane で必要な
   項目をチェックさせます。

加えて 2 つの警告を出します。

- **件名が空。** 件名が空のとき、明示的なチェックを求めます。
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
  shared/    ブラウザだけの preview で使う共有メッセージ型。
  office/    Office アダプタ。下書きを読み、Smart Alerts ハンドラを動かす。
  commands/  送信ハンドラを Office に登録する。
  dialog/    ブラウザだけの確認 preview を描画する。
```

`domain` 層が中核です。メッセージのプレーンなスナップショットと
設定を受け取り、フラットで JSON 化できるモデルを返します。何を表示し
何を必須にするかをここで決めます。ホストの API に一切触れないため、
すべてのルールをプレーンなデータでテストできます。価値はテストに
あります。

`office` 層は薄いアダプタです。Office API で下書きを読み、プレーンな
スナップショットを `domain` に渡し、Outlook 標準の Smart Alerts
ダイアログで送信を中止または許可します。中核層は Office を一切 import
しないので、この分離は構造として保たれます。新しいホスト呼び出しは
`office` 層に置いてください。

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
Outlook 標準の Smart Alerts ダイアログが表示されます。「確認を開く」
から task pane を開き、必要な項目をチェックしてから、下書きを変更せずに
もう一度送信を押します。

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

一番簡単な公開プレビューは Netlify です。このリポジトリには
`netlify.toml` が含まれているため、Netlify 側では `npm run build` で
ビルドし、`dist/` を公開できます。そのビルド中に
`scripts/generate-manifest.js` が Netlify のサイトURLを埋め込んだ
`dist/manifest.xml` を生成します。

現在の公開プレビューは
[`https://mail-lookout.netlify.app/`](https://mail-lookout.netlify.app/)
です。アドインをサイドロードするときは、このサイトの `/manifest.xml`
を使います。

タグ付きリリースでは、GitHub Releases に
`mail-lookout-manifest.xml` も添付します。常に最新ではなく固定版を
使いたい場合は、そのファイルを使います。

patch version を上げて、commit、branch push、GitHub Releases 用の
tag push まで行うには:

```sh
bun run version:patch
```

この script は `package.json`、`package-lock.json`、`manifest.xml` の
version をまとめて更新し、version commit を作り、現在の branch を
push してから `v*` release tag を作成・push します。その tag を契機に
GitHub Actions が Release asset を作ります。minor / major は
`bun run version:minor`、`bun run version:major`、明示指定は
`bun run version:set 1.2.3` を使います。push / tag なしでローカルの
version commit だけ作りたい場合は `bun run version:bump patch` を使います。

手順は [NETLIFY.md](./NETLIFY.md) を参照してください。

元のマニフェストはプレースホルダ値で出荷されます。本番運用や
Marketplace 公開の前には置き換えてください。

1. **GUID。** `manifest.xml` の `<Id>` を自分の GUID に置き換える。
2. **URL。** Netlify では、独自ドメインなどでサイトURLを上書きしたい
   ときだけ `ADDIN_HOST_URL` を設定する。ほかのホストでは、
   `manifest.xml` 内のすべての `https://localhost:3000` を自分の
   ホストに置き換えるか、`ADDIN_HOST_URL=https://example.com npm run
   build` を実行する。`dist/` フォルダをそのホストの HTTPS で
   配信する。エントリ JS は安定した名前（`/assets/commands.js`）を
   保つため、ビルドごとにマニフェストの URL は変わらない。
3. **社内ドメイン。** `src/config/defaults.ts` の `internalDomains`
   を編集する。このリストが間違っていると、すべての宛先が社外に
   見える。
4. **メタデータ。** `manifest.xml` の `ProviderName`・`SupportUrl`・
   `AppDomains` を置き換える。

そのうえで、組織向けに Microsoft 365 管理センターから公開するか、
個人向けにサイドロードします。

Outlook 内から通常のアドインとして検索・インストールできる一般公開を
目指す場合は、ホストしたプレビューが安定してから Microsoft Marketplace
/ AppSource への申請を進めます。

## 設定

すべての設定は [`src/config/defaults.ts`](./src/config/defaults.ts)
にあります。このファイルをフォークしてください。主なオプション:

- `internalDomains`: 社内として扱うドメイン。
- `sendDelaySeconds`: ブラウザ preview のダイアログだけで使う。
- `requireRecipientConfirmation`: 送信時の確認に宛先を含める。
- `requireAttachmentConfirmation`: 送信時の確認に添付ファイルを含める。
- `requireBodyConfirmation`: 送信時の確認に本文プレビューを含める。
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

## SendMode

マニフェストは `SendMode="SoftBlock"` を使います。SoftBlock では、
アドインが送信を中止したとき、ユーザーは下書きに戻って編集する必要
があります。ワンクリックの「とにかく送信」はありません。これは意図
的です。すべての中止がワンクリックで回避できる確認ツールは、ほとんど
確認になりません。

1 回目の送信では Smart Alerts ダイアログを表示し、送信を中止します。
ダイアログのアクションボタンから、チェックボックス付きの確認ペインを
開きます。確認ペインで下書きを確認済みにしたあと、下書きが変わって
いなければ次の送信を許可します。件名・本文・宛先・添付が変わった場合は、
もう一度確認を表示します。予期しないエラーが起きた場合も、ハンドラは
送信を中止します。確認なしに実メールを送ることはありません。

## 制限事項

これが何で、何でないかを正直に書きます。

- **送信イベントから独自の Office ダイアログは開けない。**
  `OnMessageSend` は event-based activation で実行されるため、
  `Office.context.ui.displayDialogAsync` などの Office UI API は
  ブロックされます。本番の送信フローは、ブラウザ preview の
  ダイアログではなく Outlook 標準の Smart Alerts ダイアログを
  使います。
- **送信ディレイはブラウザ preview 専用。** Outlook の Smart Alerts
  送信ハンドラは短時間で終わる必要があるため、本番の送信では
  「変更なしでもう一度送信」を確認ステップとして使います。
- **クラシック Outlook（Windows）は対象外。** そのホストは送信
  ハンドラに JavaScript 専用ランタイムを使います。本プロジェクトは
  HTML ページ経由で読み込む ES モジュールをビルドします。これは
  新しい Outlook と Outlook on the web が使うブラウザランタイム
  向けです。マニフェストはスキーマ上の理由で JS 専用オーバーライドを
  宣言しますが、クラシック経路はサポートもテストもしていません。
- **Outlook モバイルは非対応。** 送信時の Smart Alerts はそこでは
  動きません。

## 免責

本アドインは自己責任で使用してください。本ソフトウェアの使用、使用不能、
導入、または改変に関連して生じたいかなる損害、損失、誤送信、業務中断、
その他の責任についても、作者およびコントリビューターは責任を負いません。
本番環境で使用する前に、設定と挙動を十分に確認してください。

### OutlookOkan との関係

[OutlookOkan](https://github.com/t-miyake/OutlookOkan) は Outlook 向けの
既存の送信確認ツールです。mail-lookout はそのツールの目的に敬意を持っています。

mail-lookout は独立したプロジェクトです。OutlookOkan およびその作者と
提携、関係、承認、後援を受けているものではありません。

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
