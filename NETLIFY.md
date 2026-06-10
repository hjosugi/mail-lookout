# Netlify デプロイガイド

このアドインプロジェクトを Netlify で公開し、Outlook にサイドロード（追加）するための手順です。

---

## 1. 準備

1. プロジェクトを GitHub にプッシュします（パブリックリポジトリを推奨）。
2. [Netlify](https://www.netlify.com/) にログイン（または新規登録）します。GitHubアカウントでログインするとスムーズです。

---

## 2. Netlify でのサイト作成とデプロイ設定

1. Netlify ダッシュボードで **[Add new site]** -> **[Import an existing project]** を選択します。
2. Git プロバイダーとして **GitHub** を選択し、本リポジトリを選択します。
3. デプロイ設定は `netlify.toml` から自動で読み込まれます。画面に入力欄が出た場合は以下になっていることを確認します。

   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Production branch**: `main` (または `master`)

4. **[Deploy]** ボタンをクリックしてデプロイを実行します。

ビルド時に Netlify の環境変数 `URL` が読み込まれ、`dist/manifest.xml` 内の `https://localhost:3000` が本番URLに置き換わります。

サイト名や独自ドメインを後から変えた場合は、Netlify で再デプロイしてください。マニフェスト内のURLはビルド時に埋め込まれます。

独自ドメインを先に使いたい場合は、Netlify の **Environment variables** に `ADDIN_HOST_URL=https://your-domain.example` を設定すると、そのURLが優先されます。

### IaC で管理できる範囲

このリポジトリでは `netlify.toml` を使って、Netlify のビルド設定をコード管理しています。これで以下は Git に残ります。

- build command: `npm run build`
- publish directory: `dist`
- Node.js version
- `manifest.xml` の `Content-Type` header

つまり、Netlify に GitHub repo を一度 import すれば、その後のビルド設定は IaC 的に管理できます。

サイト作成、独自ドメイン、環境変数まで完全にコード化したい場合は Terraform の Netlify provider でも可能です。ただし `NETLIFY_TOKEN` などの管理が必要になり、最初の個人公開には少し重いです。まずは `netlify.toml` + GitHub 連携で始めるのが一番ラクです。

注意: Netlify には `DEPLOY_URL` という deploy ごとの固有URLが自動で存在します。マニフェストには通常、固定のサイトURLを入れたいので、このプロジェクトでは手動上書き用の変数名を `ADDIN_HOST_URL` にしています。

---

## 3. マニフェストファイルの入手と Outlook への登録

デプロイが完了すると、`https://<あなたのサイト名>.netlify.app` のような公開用URLが割り当てられます。

このプロジェクトの現在の公開URLは `https://mail-lookout.netlify.app/` です。

### マニフェストのダウンロード
1. ブラウザで `https://<あなたのサイト名>.netlify.app/manifest.xml` にアクセスします。
2. 画面に表示されるXMLデータを右クリックして **「名前を付けて保存」** でPCに保存します（ファイル名: `manifest.xml`）。
   > **【注意】**
   > このマニフェストファイルには、すでに Netlify の公開URLがすべて埋め込まれています。

### GitHub Releases から固定版をダウンロード

Git tag `v*` を push すると、GitHub Actions が `mail-lookout-manifest.xml` を Release asset として添付します。

常に最新でよい場合は Netlify の `/manifest.xml`、特定バージョンを配りたい場合は GitHub Releases の `mail-lookout-manifest.xml` を使います。

### Outlook へのサイドロード（インストール）
1. **Outlook on the web** または **新しい Outlook** にサインインします。
2. メール新規作成画面などの「アドインを取得」メニュー、または **[設定] -> [アドイン]** に移動します。
3. **「カスタム アドインを追加」** -> **「ファイルから追加」** を選択します。
4. 先ほどダウンロードした `manifest.xml` を選択してアップロードします。
5. インストールが成功したら、新規メールを作成して送信テストを行ってください。

## 4. 一般公開について

Netlify で公開されるのは、アドイン本体のWebファイルと配布用マニフェストです。README で `manifest.xml` のURLを案内すれば、試してもらうことはできます。

ただし、Outlook 内から通常のアドインとして検索・インストールできる状態にするには、最終的に Microsoft Marketplace / AppSource への申請が必要です。最初は Netlify で公開して反応を見る、広げる段階で Marketplace 申請に進む、という流れが現実的です。

## 5. Public repo にする前の確認

このプロジェクトは、現在の構成なら public repo として公開しやすい形です。公開前には以下を確認してください。

- `private/` は commit しない。
- `.env`、`.env.*`、証明書、秘密鍵、zip は commit しない。
- `.claude/`、`.codex/`、`.gemini/` などのローカルAI設定は commit しない。
- `src/config/defaults.ts` の `internalDomains` は、公開したくない社内ドメインに置き換えた状態で commit しない。
- `manifest.xml` の `SupportUrl` は公開先のリポジトリURLにする。
- Marketplace / AppSource に出す段階では、Support URL、Privacy Policy、Terms of Use、アイコン、説明文を本番用に整える。
