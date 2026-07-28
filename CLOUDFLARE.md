# Cloudflare Pages デプロイガイド

`avishaikofun.com` を Cloudflare 管理ドメインとして使うための手順です。

## Pages project

Cloudflare dashboard で **Workers & Pages** → **Create** → **Pages** → **Direct Upload** を選び、`avishai-kofun` という名前の project を作ります。ビルドとアップロードは GitHub Actions が行うので、**Connect to Git は使いません**（後述）。

この repo には `wrangler.toml` があり、Pages 用の出力先として `pages_build_output_dir = "dist"` を指定しています。

## デプロイ (自動)

`main` に push されると `.github/workflows/ci.yml` の `deploy` job が Cloudflare Pages へ公開します。lint・型チェック・テスト・build を通した `check` job が成功したときだけ動き、**`check` がビルドした成果物そのもの**を artifact 経由で受け取って上げるので、検証したものと配信されるものが一致します。

デプロイ後、`scripts/heartbeat.js` を `--expect-version` 付きで実行し、ホストが実際にそのバージョンの manifest を返すまで確認します。デプロイが成功を報告しつつ古いビルドが残る、という無言の失敗を job の失敗として検出するためです。

### 必要な GitHub secrets

repo の **Settings** → **Secrets and variables** → **Actions** に登録します。

- `CLOUDFLARE_API_TOKEN`: **Cloudflare Pages — Edit** 権限を持つ API token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID

この2つが無いと `deploy` job は失敗します。

### dashboard の Git 連携は使わない

Pages project に **Connect to Git** を設定していると、この job と二重にビルドが走り、どちらの成果物が最終的に残るかが push のタイミング次第になります。dashboard の **Settings** → **Builds & deployments** で Git 連携が有効なら解除してください。

### 手動デプロイ

CI を経由せず手元から上げる場合のみ使います。

```sh
bun run deploy:cloudflare
```

## Environment variables

必要に応じて Cloudflare Pages の build variables に設定します。

- `BUN_VERSION`: `1.3.14`
- `ADDIN_HOST_URL`: `https://avishaikofun.com`

`ADDIN_HOST_URL` を設定しなくても、`scripts/generate-manifest.js` は既定で `https://avishaikofun.com` を埋め込みます。

## Custom domains

このプロジェクトが持つのは **apex だけ**です。

- `avishaikofun.com`

`www.avishaikofun.com` は**このプロジェクトには付けません**。コーポレート
サイトは [hjosugi/avishaikofun-site](https://github.com/hjosugi/avishaikofun-site)
に分離し、別の Pages project（`avishaikofun-site`）から www で配信します。
以前このプロジェクトに www を付けていた場合は、**先に外してから**新しい
プロジェクト側に追加してください。1つのカスタムドメインを2つの Pages
project に同時に割り当てることはできません。

apex を手放せない理由は明確です。Outlook は送信のたびに apex から
`commands.html` を読み込み、マニフェストがその URL を直接埋め込んで
います。apex の `/` はコーポレートサイトへの 308 リダイレクトのみで
（`public/_redirects`）、それ以外のパスはすべてアドインが持ちます。

Cloudflare の同じ account にある zone なら、apex domain の custom domain と DNS record は dashboard から作成できます。

## Verify

DNS と HTTPS 証明書が反映されたら確認します。

```sh
curl -I https://avishaikofun.com/
curl -I https://avishaikofun.com/manifest.xml
bun run heartbeat
```
