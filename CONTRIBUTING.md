# Contributing to Mail Lookout

Thanks for your interest! Mail Lookout is a small, serverless Outlook
add-in. This guide covers the local setup and how the code is organized.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3 (see `engines` in `package.json`)

## Setup

```sh
bun install
bun run dev-certs   # one-time: trust the local HTTPS dev certificate
```

## Develop

Two ways to work on the UI:

- **Emulator (no Outlook needed)** — fastest loop for the review UI:

  ```sh
  bun run dev:emulator
  ```

  Opens `/emulator.html`: compose a fake draft on the left, run the
  review on the right. It mirrors the task-pane flow (review → countdown
  → "sent").

- **Real Outlook** — to test the Smart Alerts send flow end to end:

  ```sh
  bun run dev:outlook   # serves on https://localhost:3000
  ```

  Then sideload `manifest.xml` in new Outlook or Outlook on the web
  (Settings → Add-ins → Add a custom add-in → From file). After changing
  the manifest, remove and re-add the add-in to clear Outlook's cache.

## Checks

Run these before opening a PR (or `bun run check` for all of them):

```sh
bun run typecheck   # tsc, app + node configs
bun run lint        # oxlint
bun run format      # oxfmt (use lint:fix / format to write)
bun run test        # Vitest
bun run build       # production build + manifest generation
```

## Project layout

The code is layered; lower layers don't import higher ones. Office APIs
are only used in the `office/` layer (and entry files), enforced by an
empty `types` in `tsconfig.json` plus explicit triple-slash references.

| Path | What it is |
| --- | --- |
| `src/config/` | Config shape, defaults, and user settings logic (pure) |
| `src/domain/` | Pure logic: recipients, attachments, body, the review model |
| `src/i18n/` | Message catalog (`en`, `ja`) with a compiler-checked contract |
| `src/office/` | Office-API layer: send handler, settings (roaming), storage |
| `src/dialog/` | The review UI component (`renderDialog`) and its CSS |
| `src/taskpane/`, `src/settings/` | The task-pane and settings entry points |
| `src/emulator/` | The local dev harness |
| `test/` | Vitest tests for the pure layers |

Import from `src` with the `@/` alias (e.g. `@/domain/review`) when a
relative path would be long.

## How it works (in one paragraph)

On Send, the Smart Alerts handler (`office/sendHandler.ts`) blocks the
send and opens the task pane. The user reviews recipients, attachments,
and body; on confirm the pane runs a send-delay countdown and then sends
the message with `item.sendAsync`. Internal-vs-external is decided by the
domains in the config (editable in the Settings pane, stored in Outlook
roaming settings).

## Pull requests

- Keep changes focused; add or update tests for behavior changes.
- Make sure `bun run check` passes.
- The default branch is `main`. Releases are cut by bumping the version
  and pushing a `v*` tag (`bun run version:patch` then `bun run release:tag`).
