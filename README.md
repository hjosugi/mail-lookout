# mail-lookout

A send-confirmation add-in for new Outlook and Outlook on the web.

It runs when you press Send. It shows a dialog with the recipients,
the attachments, and a preview of the body. You check what you need
to check, wait out a short delay, and then send. The goal is to stop
the small mistakes: the wrong recipient, the forgotten attachment,
the empty subject.

The name is literal: a lookout for your outgoing mail — a quiet watch
that flags problems before a message leaves.

> Japanese version: [README.ja.md](./README.ja.md)

## Features

This add-in does four things at send time.

1. **Recipient check.** It lists every recipient by field (To, Cc,
   Bcc) and marks external ones. It asks you to confirm each
   recipient one by one.
2. **Attachment check.** It lists every real attachment and asks
   you to confirm each file one by one.
3. **Body check.** It shows a preview of the body and asks you to
   confirm you reviewed it.
4. **Send delay.** It counts down a few seconds before the send
   button turns on. This is a pause to think, not a scheduled send.

It also raises two soft warnings:

- **Empty subject.** A warning when the subject is blank.
- **Forgotten attachment.** A warning when the body mentions an
  attachment ("see attached", "添付") but no file is attached.

There is no settings task pane. All behavior lives in one config
file, [`src/config/defaults.ts`](./src/config/defaults.ts). For an
organization, shipping one config file is simpler to deploy and
review than a per-user UI.

## Requirements

- New Outlook on Windows, or Outlook on the web.
- Mailbox requirement set 1.15 or later.
- Node.js 22.12 or later for development.

This add-in does **not** run on Outlook mobile. See the limitations
section for classic Outlook on Windows.

## Architecture

The code is split so the logic does not depend on Office.

```
src/
  domain/    Pure logic. No Office, no DOM, no time. Fully tested.
  config/    The config shape and its defaults.
  i18n/      Type-safe messages. One file per language.
  shared/    The message protocol between handler and dialog.
  office/    The Office adapter. Reads the draft, runs the handler.
  commands/  Registers the send handler with Office.
  dialog/    Renders the confirmation dialog in the browser.
```

The `domain` layer is the core. It takes a plain snapshot of the
message plus the config, and it returns a flat, JSON-serializable
model. It decides what to show and what to require. Because it
touches nothing from the host, every rule is tested with plain
data. The tests are where the value is.

The `office` layer is a thin adapter. It reads the draft through
the Office APIs, hands a plain snapshot to `domain`, opens the
dialog, and then allows or cancels the send. The core layers import
nothing from Office, so the boundary holds by construction; keep any
new host calls in the `office` layer.

## Setup

```sh
# 1. Install dependencies.
npm install

# 2. Trust a local HTTPS certificate. Outlook requires HTTPS.
npm run dev-certs

# 3. Start the dev server on https://localhost:3000.
npm run dev:outlook
```

Then sideload `manifest.xml` in Outlook. The steps depend on the
host:

- **Outlook on the web:** open Settings, go to the add-ins page,
  choose "Add a custom add-in" then "Add from file", and pick
  `manifest.xml`.
- **New Outlook on Windows:** use the same add-ins management page,
  reached from Outlook on the web with the same account.

After sideloading, open a new message, fill in a recipient, and
press Send. The confirmation dialog should appear.

### Local emulator without Outlook

You can test the review flow in a browser without Outlook:

```sh
npm install
npm run dev:emulator
```

Or start the normal dev server and open `/emulator.html` on the URL
Vite prints. If port 3000 is busy, Vite will choose the next free
port, for example `https://localhost:3001/emulator.html`. The
emulator uses the same domain logic and dialog renderer as the
Outlook send handler, but it does not load Office.js or call Outlook
APIs. Edit the draft fields, switch scenarios, then click "Review
send" to rebuild the dialog.

For Outlook sideloading, use `npm run dev:outlook`. The manifest is
fixed to `https://localhost:3000`, so that script intentionally fails
if port 3000 is already in use.

## Verify the code

```sh
npm run check
```

This runs, in order: Biome (format and lint), type check on both
tsconfigs, tests with coverage, the production build, and manifest
validation. Each step must pass. Useful single steps:

```sh
npm run typecheck      # tsc on src and on the build config
npm run lint           # biome lint
npm run format         # biome format --write
npm run test           # vitest, run once
npm run test:coverage  # vitest with coverage on the pure layers
npm run build          # tsc --noEmit then vite build
npm run validate       # office-addin-manifest validate
```

## Production deployment

The manifest ships with placeholder values. Replace them before you
deploy.

1. **GUID.** Replace the `<Id>` in `manifest.xml` with your own
   GUID.
2. **URLs.** Replace every `https://localhost:3000` in
   `manifest.xml` with your host. Build with `npm run build` and
   serve the `dist/` folder over HTTPS at that host. The entry JS
   keeps a stable name (`/assets/commands.js`), so the manifest
   URLs do not change between builds.
3. **Internal domains.** Edit `internalDomains` in
   `src/config/defaults.ts`. If this list is wrong, every recipient
   looks external.
4. **Metadata.** Replace `ProviderName`, `SupportUrl`, and
   `AppDomains` in `manifest.xml`.

Then publish through the Microsoft 365 admin center for your
organization, or sideload for a single user.

## Configuration

All settings live in [`src/config/defaults.ts`](./src/config/defaults.ts).
Fork that file. The main options:

- `internalDomains`: domains treated as internal.
- `sendDelaySeconds`: seconds to count down before send turns on.
  Set `0` to disable.
- `requireRecipientConfirmation`: check each recipient one by one.
- `requireAttachmentConfirmation`: check each attachment one by
  one.
- `requireBodyConfirmation`: confirm the body was reviewed.
- `attachmentKeywords`: words that hint the body refers to an
  attachment, used by the forgotten-attachment warning.
- `warnOnEmptySubject`: warn when the subject is blank.
- `fallbackLocale`: language used when the host language is
  unknown.
- `dialog`: dialog width and height as a percent of the screen.

## Add a language

The messages are type-safe. To add a language:

1. Copy `src/i18n/locales/en.ts` to a new file, for example
   `de.ts`, and translate every value.
2. Add one line to `src/i18n/catalog.ts`: import it and add it to
   the `locales` object.

The compiler will tell you if you miss a key. A test in
`test/i18n.test.ts` also checks that every locale has the same set
of keys. Nothing else needs to change. The locale tag type updates
itself from the keys of `locales`.

## SendMode: SoftBlock vs PromptUser

The manifest uses `SendMode="SoftBlock"`. With SoftBlock, when the
add-in cancels a send, the user must go back and edit the draft.
There is no one-click "send anyway". This is on purpose: a
confirmation tool whose every cancel is one click to bypass does
not confirm much.

If you prefer a softer tool, change `SendMode` to `PromptUser` in
`manifest.xml`. Then every cancel offers a "send anyway" button.
The tradeoff is that users can click past the check without
reviewing.

The handler is careful in one case. If the rich dialog cannot open
at all, the handler does **not** trap the user. It falls back to
the host's built-in prompt and uses `PromptUser` for that one path,
so a bug in the add-in can never block real mail. On any unexpected
error, the handler allows the send.

## Limitations

Be honest about what this is and is not.

- **The send delay is a dialog countdown, not a scheduled send.**
  The button is disabled for a few seconds while the dialog is
  open. The mail is not held on a server and sent later. When you
  click send, it sends.
- **A "still working" notice may appear.** Outlook shows its own
  notification if a send handler runs longer than five seconds.
  Because this add-in opens a review dialog and waits for you, that
  notice can appear. It is part of the host, and it cannot be
  removed.
- **Classic Outlook on Windows is not a target.** That host uses a
  JavaScript-only runtime for send handlers. This project builds an
  ES module that loads through an HTML page in a browser runtime,
  which is what new Outlook and Outlook on the web use. The
  manifest declares a JS-only override for schema reasons, but the
  classic path is not supported or tested.
- **Outlook mobile is not supported.** Smart Alerts on send do not
  run there.

## Disclaimer

Use this add-in at your own risk. The authors and contributors are
not responsible for any damages, losses, misdelivery, business
interruption, or other liability arising from the use of, inability
to use, deployment of, or modification of this software. Review the
configuration and behavior before using it in a production
environment.

### Relation to OutlookOkan

[OutlookOkan](https://github.com/0xww/OutlookOkan) is an existing
send-confirmation tool for Outlook. mail-lookout respects the work
and the problem it addresses.

mail-lookout is an independent project. It is not affiliated with,
endorsed by, or sponsored by OutlookOkan or its author.

## Migrating to the unified manifest

This project ships an add-in only manifest (`manifest.xml`), which
is well supported on Outlook on the web and new Outlook today. The
unified manifest for Microsoft 365 is the newer format and is the
direction Microsoft is moving. If you need it, the
`office-addin-manifest` tool can convert an XML manifest to the
unified format. The runtime code in this project does not change;
only the manifest does.

## License

[MIT](./LICENSE)
