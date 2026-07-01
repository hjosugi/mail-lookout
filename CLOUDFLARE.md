# Cloudflare Pages デプロイガイド

`avishaikofun.com` を Cloudflare 管理ドメインとして使うための手順です。

## Pages project

Cloudflare dashboard で **Workers & Pages** → **Create** → **Pages** → **Connect to Git** を選び、この GitHub repo を接続します。

- Project name: `avishai-kofun`
- Production branch: `main`
- Build command: `bun run build`
- Build output directory: `dist`
- Root directory: repository root

この repo には `wrangler.toml` があり、Pages 用の出力先として `pages_build_output_dir = "dist"` を指定しています。

## Environment variables

必要に応じて Cloudflare Pages の build variables に設定します。

- `BUN_VERSION`: `1.3.14`
- `ADDIN_HOST_URL`: `https://avishaikofun.com`

`ADDIN_HOST_URL` を設定しなくても、`scripts/generate-manifest.js` は既定で `https://avishaikofun.com` を埋め込みます。

## Custom domains

Pages project の **Custom domains** で以下を追加します。

- `avishaikofun.com`
- `www.avishaikofun.com`

Cloudflare の同じ account にある zone なら、apex domain の custom domain と DNS record は dashboard から作成できます。

## Verify

DNS と HTTPS 証明書が反映されたら確認します。

```sh
curl -I https://avishaikofun.com/
curl -I https://avishaikofun.com/manifest.xml
bun run heartbeat
```
