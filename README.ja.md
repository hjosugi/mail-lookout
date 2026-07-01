# Mail Lookout

新しいOutlookとOutlook on the web向けの送信確認アドインです。

送信ボタンを押したときに動きます。Outlook標準のSmart Alertsダイアログから、宛先・添付ファイル・件名・本文をチェックできる確認ペインを開きます。必要な項目をチェックしたあと、確認ペインが送信します。
目的は小さなミスを防ぐことです。宛先の間違い、添付の付け忘れ、件名の
空欄、といったものです。

**スケジュール送信/Send laterは対象外です。** Outlookの下書きに
未来の配信時刻が設定されている場合、Mail Lookoutは確認フローを
スキップし、Outlookにそのまま予定送信させます。そのため、
スケジュール送信メールはこのアドインでは確認されません。

名前はそのままの意味で、送信メールの見張り役です。メッセージが
出ていく前に問題を知らせます。

> 英語版: [README.md](./README.md)

## 機能

このアドインは送信時に4つのことを行います。

1. **宛先確認。** すべての宛先をフィールド別（To/Cc/Bcc）に
   一覧表示し、社外の宛先には印を付けます。
2. **添付ファイル確認。** 実体のある添付をすべて一覧表示し、ファイル
   を確認できるようにします。
3. **本文確認。** 本文のプレビューを表示します。
4. **確認ペインで確認完了。** 1回目の送信を止め、task paneで必要な
   項目をチェックさせます。

加えて2つの警告を出します。

- **件名が空。** 件名が空のとき、明示的なチェックを求めます。
- **添付の付け忘れ。** 本文が添付に言及している（「添付」「see
  attached」など）のにファイルが添付されていないとき警告します。

**設定**タスクペインから、社内ドメインとデフォルトの待ち時間を
ユーザーごとに変更できます。これらはOutlookのローミング設定に
ユーザー単位で保存され、端末をまたいで引き継がれます。それ以外の
挙動と、出荷時の既定値は1つの設定ファイル
[`src/config/defaults.ts`](./src/config/defaults.ts)にあります。

## 動作要件

- 新しいOutlook（Windows）またはOutlook on the web。
- Mailbox requirement set 1.15以降。
- 開発にはBun 1.3以降。

このアドインはOutlookモバイルでは動きません。クラシックOutlookについては「制限事項」を参照してください。

## アーキテクチャ

ロジックがOfficeに依存しないようにコードを分けています。

```
src/
  domain/    純粋なロジック。OfficeもDOMも時刻も使わない。全テスト済み。
  config/    設定の型とデフォルト値。
  i18n/      型安全なメッセージ。1言語につき1ファイル。
  shared/    ブラウザだけのpreviewで使う共有メッセージ型。
  office/    Officeアダプタ。下書きを読み、Smart Alertsハンドラを動かす。
  commands/  送信ハンドラをOfficeに登録する。
  dialog/    ブラウザだけの確認previewを描画する。
```

`domain`層が中核です。メッセージのプレーンなスナップショットと
設定を受け取り、フラットでJSON化できるモデルを返します。何を表示し
何を必須にするかをここで決めます。ホストのAPIに一切触れないため、
すべてのルールをプレーンなデータでテストできます。価値はテストに
あります。

`office`層は薄いアダプタです。Office APIで下書きを読み、プレーンな
スナップショットを`domain`に渡し、Outlook標準のSmart Alertsダイアログで送信を中止または許可します。中核層はOfficeを一切importしないので、この分離は構造として保たれます。新しいホスト呼び出しは
`office`層に置いてください。

## セットアップ

```sh
# 1. 依存関係をインストールする。
bun install

# 2. ローカルのHTTPS証明書を信頼する。OutlookはHTTPSを要求する。
bun run dev-certs

# 3. https://localhost:3000で開発サーバーを起動する。
bun run dev:outlook
```

そのあとOutlookに`manifest.xml`をサイドロードします。手順は
ホストによって異なります。

- **Outlook on the web:** 設定を開き、アドインのページで「カスタム
  アドインを追加」→「ファイルから追加」を選び、`manifest.xml`を
  指定します。
- **新しいOutlook（Windows）:** 同じアカウントのOutlook on the webから、同じアドイン管理ページを使います。

サイドロード後、新規メールを開き、宛先を入れて送信を押します。
Outlook標準のSmart Alertsダイアログが表示されます。「確認画面を開く」
からtask paneを開き、必要な項目をチェックしてから
「確認して送信する」を押します。

### Outlookなしのローカルemulator

Outlookを使わず、ブラウザだけで確認フローを試せます。

```sh
bun install
bun run dev:emulator
```

または通常の開発サーバーを起動して
Viteが表示するURLの`/emulator.html`を開きます。3000番ポートが使われている場合、
`https://localhost:3001/emulator.html` のように次の空きポートを使います。
このemulatorはOutlookのAPIや Office.jsを使わず、実際のドメインロジックとダイアログrendererを
そのまま使います。下書き欄やシナリオを変更し、「Review send」を押すと確認ダイアログを再生成できます。

Outlookにサイドロードして試す場合は`bun run dev:outlook`を使います。
`manifest.xml`は`https://localhost:3000`固定なので、このscriptは
3000番ポートが使われていると意図的に失敗します。

## コードを検証する

```sh
bun run check
```

これは順に、lint（oxlint）とフォーマットチェック（oxfmt）・両tsconfigの型チェック・
カバレッジ付きテスト・本番ビルド・マニフェスト検証を実行します。
各ステップが通る必要があります。個別のステップ:

```sh
bun run typecheck      # srcとbuild設定へのtsc
bun run lint           # oxlint
bun run format         # oxfmt --write
bun run test           # vitestを1回実行
bun run test:coverage  # 純粋層へのカバレッジ付きvitest
bun run build          # tsc --noEmitのあとvite build
bun run validate       # office-addin-manifest validate
```

## 本番デプロイ

公開プレビューはCloudflare Pagesにデプロイします。このリポジトリには
`wrangler.toml`が含まれているため、Pages側では`bun run build`で
ビルドし、`dist/`を公開できます。そのビルド中に
`scripts/generate-manifest.js`が`https://avishaikofun.com`を
埋め込んだ`dist/manifest.xml`を生成します。

現在の公開プレビューは
[`https://avishaikofun.com/`](https://avishaikofun.com/)
です。アドインをサイドロードするときは、このサイトの`/manifest.xml`
を使います。

タグ付きリリースでは、GitHub Releasesに
`mail-lookout-manifest.xml`も添付します。常に最新ではなく固定版を
使いたい場合は、そのファイルを使います。

patch versionを上げて、commit、branch push、GitHub Releases用の
tag pushまで行うには:

```sh
bun run version:patch
```

このscriptは`package.json`と`manifest.xml`の
versionをまとめて更新し、version commitを作り、現在のbranchを
pushしてから`v*` release tagを作成・pushします。そのtagを契機に
GitHub ActionsがRelease assetを作ります。minor/majorは
`bun run version:minor`、`bun run version:major`、明示指定は
`bun run version:set 1.2.3`を使います。scriptは次のversionを表示して
`y/N`確認してからファイル変更に進みます。push/tagなしでローカルの
version commitだけ作りたい場合は`bun run version:bump patch`を使います。

手順は[CLOUDFLARE.md](./CLOUDFLARE.md)を参照してください。
`NETLIFY.md`は代替デプロイ手順として残しています。

元のマニフェストはプレースホルダ値で出荷されます。本番運用や
Marketplace公開の前には置き換えてください。

1. **GUID。** `manifest.xml`の`<Id>`を自分のGUIDに置き換える。
2. **URL。** Cloudflare Pagesでは`https://avishaikofun.com`を
   使う。ほかのホストでは、`manifest.xml`内のすべての
   `https://localhost:3000`を自分のホストに置き換えるか、
   `ADDIN_HOST_URL=https://your-domain.example bun run build`を
   実行する。`dist/`フォルダをそのホストのHTTPSで配信する。
   エントリJSは安定した名前（`/assets/commands.js`）を保つため、
   ビルドごとにマニフェストのURLは変わらない。
3. **社内ドメイン。** `src/config/defaults.ts`の`internalDomains`
   を編集する。出荷時の既定値は`avishaikofun.com`。このリストが
   間違っていると、すべての宛先が社外に見える。
4. **メタデータ。** `manifest.xml`の`ProviderName`・`SupportUrl`・
   `AppDomains`を置き換える。

そのうえで、組織向けにMicrosoft 365管理センターから公開するか、
個人向けにサイドロードします。

Outlook内から通常のアドインとして検索・インストールできる一般公開を
目指す場合は、ホストしたプレビューが安定してからMicrosoft Marketplace
/AppSourceへの申請を進めます。

## 設定

出荷時の既定値は[`src/config/defaults.ts`](./src/config/defaults.ts)
にあります。変更するにはこのファイルをフォークしてください。実行時は
設定タスクペインが、社内ドメインとデフォルトの待ち時間をユーザーごとに
上書きします。主なオプション:

### デフォルト送信待機時間の設定方法

OutlookのリボンでMail Lookoutの**Settings**を開き、
**デフォルトの待ち時間（分）**に値を入力して保存します。`0`は即時送信、
`0.1`は6秒、`1.5`は90秒です。設定はOutlookのローミング設定に
保存され、同じユーザーの次回以降の確認ペインで使われます。

- `internalDomains`: 社内として扱うドメイン（設定ペインでも変更可）。
- `sendDelaySeconds`: 確認後に送信するまでのカウントダウンの既定値
  （設定ペインでも変更可）。
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

1. `src/i18n/locales/en.ts`を新しいファイル（例`de.ts`）に
   コピーし、すべての値を翻訳する。
2. `src/i18n/catalog.ts`に1行追加する。importして`locales`
   オブジェクトに加えるだけ。

キーが足りなければコンパイラが教えてくれます。`test/i18n.test.ts`
のテストも、すべてのロケールが同じキー集合を持つことを確認します。
それ以外に変更は不要です。ロケールタグの型は`locales`のキーから
自動で更新されます。

## SendMode

マニフェストは`SendMode="SoftBlock"`を使います。SoftBlockでは、
アドインが送信を中止したとき、ユーザーは下書きに戻って編集する必要
があります。ワンクリックの「とにかく送信」はありません。これは意図
的です。すべての中止がワンクリックで回避できる確認ツールは、ほとんど
確認になりません。

1回目の送信ではSmart Alertsダイアログを表示し、送信を中止します。
ダイアログのアクションボタンから、チェックボックス付きの確認ペインを
開きます。確認ペインで下書きを確認済みにしたあと、Outlookのcompose
API経由で送信します。予期しないエラーが起きた場合も、ハンドラは送信を
中止します。確認なしに実メールを送ることはありません。

## 制限事項

これが何で、何でないかを正直に書きます。

- **送信イベントから独自のOfficeダイアログは開けない。**
  `OnMessageSend`はevent-based activationで実行されるため、
  `Office.context.ui.displayDialogAsync`などのOffice UI APIは
  ブロックされます。本番の送信フローは、ブラウザpreviewの
  ダイアログではなくOutlook標準のSmart Alertsダイアログを
  使います。
- **送信ディレイは確認ペイン内で動く。** OutlookのSmart Alerts送信ハンドラは短時間で終わる必要があるため、確認ペインが
  カウントダウンを持ち、その後Outlookのcompose送信APIを呼びます。
  ペインを閉じたり更新したりすると、待機中の送信はキャンセルされます。
- **スケジュール送信/Send laterは意図的に対象外。** Mail Lookoutは
  送信時に`delayDeliveryTime`を確認します。未来の配信時刻が設定されて
  いる場合、アドインはすぐにイベントを許可し、確認ペインを開きません。
  スケジュール送信が即時の`sendAsync`送信に変わることを避けるためです。
  その代わり、スケジュール送信メールはMail Lookoutでは保護されません。
- **クラシックOutlook（Windows）は対象外。** そのホストは送信
  ハンドラにJavaScript専用ランタイムを使います。本プロジェクトは
  HTMLページ経由で読み込むESモジュールをビルドします。これは
  新しいOutlookとOutlook on the webが使うブラウザランタイム
  向けです。マニフェストはスキーマ上の理由でJS専用オーバーライドを
  宣言しますが、クラシック経路はサポートもテストもしていません。
- **Outlookモバイルは非対応。** 送信時のSmart Alertsはそこでは
  動きません。

## 免責

本アドインは自己責任で使用してください。本ソフトウェアの使用、使用不能、
導入、または改変に関連して生じたいかなる損害、損失、誤送信、業務中断、
その他の責任についても、作者およびコントリビューターは責任を負いません。
本番環境で使用する前に、設定と挙動を十分に確認してください。

### OutlookOkanとの関係

[OutlookOkan](https://github.com/t-miyake/OutlookOkan)はOutlook向けの
既存の送信確認ツールです。Mail Lookoutはそのツールの目的に敬意を持っています。

Mail Lookoutは独立したプロジェクトです。OutlookOkanおよびその作者と
提携、関係、承認、後援を受けているものではありません。

## 統合マニフェストへの移行

本プロジェクトはアドイン専用マニフェスト（`manifest.xml`）で出荷
します。これは現在、Outlook on the webと新しいOutlookで十分に
サポートされています。Microsoft 365の統合マニフェストはより新しい
形式で、Microsoftが進んでいる方向です。必要なら、
`office-addin-manifest`ツールでXMLマニフェストを統合形式に変換
できます。本プロジェクトのランタイムコードは変わりません。変わるのは
マニフェストだけです。

## ライセンス

[MIT](./LICENSE)
