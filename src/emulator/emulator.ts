import { defaultConfig } from "../config"
import { normalizeEmailAddress } from "../domain/recipients"
import { buildReviewModel, canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import type { Attachment, FieldRecipient, MessageSnapshot, RecipientField } from "../domain/types"
import { getMessages } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import { renderDialog } from "../dialog/render"
import "./emulator.css"

interface Scenario {
  readonly id: string
  readonly label: string
  readonly snapshot: MessageSnapshot
}

const scenarios: readonly Scenario[] = [
  {
    id: "multiple-recipients",
    label: "Multiple recipients (To/Cc/Bcc)",
    snapshot: {
      subject: "Quarterly forecast review",
      body: "Hi team,\n\nPlease see attached forecast before the 15:00 review.\n\nRegards,\nMail Lookout",
      recipients: [
        recipient("to", "Aki Tanaka", "aki@example.com"),
        recipient("to", "Mina Sato", "mina@example.com"),
        recipient("cc", "Jordan Lee", "jordan@partner.test"),
        recipient("cc", "Sora Kim", "sora@vendor.test"),
        recipient("bcc", "Riku Mori", "riku@example.com"),
        recipient("bcc", "", "review@client.test"),
      ],
      attachments: [attachment("forecast.xlsx", 184320), attachment("notes.pdf", 94208)],
      senderEmail: "sender@example.com",
    },
  },
  {
    id: "external-attachment",
    label: "External recipient with attachment",
    snapshot: {
      subject: "Quarterly forecast review",
      body: "Hi team,\n\nPlease see attached forecast before the 15:00 review.\n\nRegards,\nMail Lookout",
      recipients: [
        recipient("to", "Aki Tanaka", "aki@example.com"),
        recipient("cc", "Jordan Lee", "jordan@partner.test"),
      ],
      attachments: [attachment("forecast.xlsx", 184320), attachment("notes.pdf", 94208)],
      senderEmail: "sender@example.com",
    },
  },
  {
    id: "forgotten-attachment",
    label: "Forgotten attachment warning",
    snapshot: {
      subject: "Contract draft",
      body: "添付ファイルをご確認ください。\n問題なければ本日中に送付します。",
      recipients: [recipient("to", "Sora Kim", "sora@vendor.test")],
      attachments: [],
      senderEmail: "sender@example.com",
    },
  },
  {
    id: "internal-clean",
    label: "Internal message",
    snapshot: {
      subject: "Weekly sync notes",
      body: "Today's notes are in the shared workspace. No customer data included.",
      recipients: [recipient("to", "Mina Sato", "mina@example.com")],
      attachments: [],
      senderEmail: "sender@example.com",
    },
  },
  {
    id: "empty-draft",
    label: "Empty draft",
    snapshot: {
      subject: "",
      body: "",
      recipients: [],
      attachments: [],
      senderEmail: "sender@example.com",
    },
  },
]

function firstScenario(): Scenario {
  const scenario = scenarios[0]
  if (!scenario) {
    throw new Error("No emulator scenarios configured.")
  }
  return scenario
}

let currentTimer: number | null = null

function recipient(
  field: RecipientField,
  displayName: string,
  emailAddress: string,
): FieldRecipient {
  return { field, displayName, emailAddress: normalizeEmailAddress(emailAddress) }
}

function attachment(name: string, size: number | null): Attachment {
  return { id: name, name, size, isInline: false }
}

function query<T extends HTMLElement>(selector: string, root: ParentNode = document): T {
  const node = root.querySelector<T>(selector)
  if (!node) {
    throw new Error(`Missing emulator element: ${selector}`)
  }
  return node
}

function parseRecipientLine(field: RecipientField, line: string): FieldRecipient | null {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return null
  }

  const match = /^(?<name>.*?)\s*<(?<email>[^<>]+)>$/.exec(trimmed)
  if (match?.groups) {
    const name = match.groups.name
    const email = match.groups.email
    if (name !== undefined && email !== undefined) {
      return recipient(field, name.trim(), email.trim())
    }
  }

  return recipient(field, "", trimmed)
}

// Real mail clients let you list several recipients on one line,
// separated by a comma or semicolon. Split on those as well as
// newlines so multi-recipient entry is not awkward. (A display name
// containing a comma is the price; bare addresses and "Name <email>"
// both round-trip fine.)
const RECIPIENT_SEPARATORS = /[\n,;]+/

function parseRecipients(field: RecipientField, raw: string): readonly FieldRecipient[] {
  return raw
    .split(RECIPIENT_SEPARATORS)
    .map(token => parseRecipientLine(field, token))
    .filter((parsed): parsed is FieldRecipient => parsed !== null)
}

function parseAttachmentLine(index: number, line: string): Attachment | null {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return null
  }

  const [rawName, rawSize] = trimmed.split(/[,|]/, 2)
  const name = rawName?.trim() ?? ""
  if (name.length === 0) {
    return null
  }

  const parsedSize = rawSize === undefined ? null : Number(rawSize.trim())
  const size = parsedSize === null || Number.isNaN(parsedSize) ? null : Math.max(0, parsedSize)
  return { id: `local-${index}`, name, size, isInline: false }
}

function parseAttachments(raw: string): readonly Attachment[] {
  return raw
    .split("\n")
    .map((line, index) => parseAttachmentLine(index, line))
    .filter((parsed): parsed is Attachment => parsed !== null)
}

function recipientText(snapshot: MessageSnapshot, field: RecipientField): string {
  return snapshot.recipients
    .filter(item => item.field === field)
    .map(item =>
      item.displayName.length > 0
        ? `${item.displayName} <${item.emailAddress}>`
        : item.emailAddress,
    )
    .join("\n")
}

function attachmentText(snapshot: MessageSnapshot): string {
  return snapshot.attachments
    .filter(item => !item.isInline)
    .map(item => `${item.name}${item.size === null ? "" : `, ${item.size}`}`)
    .join("\n")
}

function snapshotFromForm(): MessageSnapshot {
  const recipients = [
    ...parseRecipients("to", query<HTMLTextAreaElement>("#emu-to").value),
    ...parseRecipients("cc", query<HTMLTextAreaElement>("#emu-cc").value),
    ...parseRecipients("bcc", query<HTMLTextAreaElement>("#emu-bcc").value),
  ]

  return {
    subject: query<HTMLInputElement>("#emu-subject").value,
    body: query<HTMLTextAreaElement>("#emu-body").value,
    recipients,
    attachments: parseAttachments(query<HTMLTextAreaElement>("#emu-attachments").value),
    senderEmail: "sender@example.com",
  }
}

function configFromForm() {
  return {
    ...defaultConfig,
    sendDelaySeconds: Number(query<HTMLInputElement>("#emu-delay").value),
    requireRecipientConfirmation: query<HTMLInputElement>("#emu-require-recipients").checked,
    requireAttachmentConfirmation: query<HTMLInputElement>("#emu-require-attachments").checked,
    requireBodyConfirmation: query<HTMLInputElement>("#emu-require-body").checked,
    fallbackLocale: query<HTMLSelectElement>("#emu-locale").value as LocaleTag,
  }
}

function fillForm(snapshot: MessageSnapshot): void {
  query<HTMLInputElement>("#emu-subject").value = snapshot.subject
  query<HTMLTextAreaElement>("#emu-body").value = snapshot.body
  query<HTMLTextAreaElement>("#emu-to").value = recipientText(snapshot, "to")
  query<HTMLTextAreaElement>("#emu-cc").value = recipientText(snapshot, "cc")
  query<HTMLTextAreaElement>("#emu-bcc").value = recipientText(snapshot, "bcc")
  query<HTMLTextAreaElement>("#emu-attachments").value = attachmentText(snapshot)
}

function stopTimer(): void {
  if (currentTimer !== null) {
    window.clearInterval(currentTimer)
    currentTimer = null
  }
}

function setStatus(text: string): void {
  query<HTMLElement>("#emu-status").textContent = text
}

/** Format a remaining duration as "M:SS" once past a minute, else "Ns". */
function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`
}

function showToast(remaining: number, locale: LocaleTag): void {
  query<HTMLElement>("#emu-toast-text").textContent =
    locale === "ja"
      ? `あと ${formatCountdown(remaining)} で送信します`
      : `Sending in ${formatCountdown(remaining)}`
  query<HTMLButtonElement>("#emu-toast-cancel").textContent =
    locale === "ja" ? "キャンセル" : "Cancel"
  query<HTMLElement>("#emu-toast").hidden = false
}

function hideToast(): void {
  query<HTMLElement>("#emu-toast").hidden = true
}

/**
 * Run the post-Send wait as a small corner toast.
 *
 * The dialog is already closed by the time this runs, so the user is
 * free to keep editing. When the countdown reaches zero the send is
 * allowed; the toast's Cancel button stops it.
 */
function startPendingSend(seconds: number, locale: LocaleTag): void {
  stopTimer()
  let remaining = seconds
  showToast(remaining, locale)
  currentTimer = window.setInterval(() => {
    remaining -= 1
    if (remaining <= 0) {
      stopTimer()
      hideToast()
      setStatus(locale === "ja" ? "送信を許可しました。" : "Send allowed.")
    } else {
      showToast(remaining, locale)
    }
  }, 1000)
}

function cancelPendingSend(locale: LocaleTag): void {
  if (currentTimer === null) {
    return
  }
  stopTimer()
  hideToast()
  setStatus(locale === "ja" ? "送信をキャンセルしました。" : "Send cancelled.")
}

function closeReview(): void {
  stopTimer()
  query<HTMLElement>("#emu-dialog").hidden = true
  query<HTMLElement>("#emu-preview").replaceChildren()
}

function openReview(): void {
  query<HTMLElement>("#emu-dialog").hidden = false
}

function mountReview(model: ReviewModel, locale: LocaleTag): void {
  stopTimer()
  hideToast()
  const preview = query<HTMLElement>("#emu-preview")
  const messages = getMessages(locale)
  let state: ReviewState = initialReviewState(model)
  // The wait before sending starts from the model but can be changed
  // on the dialog, so it lives in the controller.
  let delaySeconds = model.sendDelaySeconds

  const handle = renderDialog(model, messages, {
    onRecipientToggle(index, checked) {
      const next = new Set(state.confirmedRecipients)
      if (checked) {
        next.add(index)
      } else {
        next.delete(index)
      }
      state = { ...state, confirmedRecipients: next }
      handle.setSendEnabled(canSend(model, state))
    },
    onAttachmentToggle(index, checked) {
      const next = new Set(state.confirmedAttachments)
      if (checked) {
        next.add(index)
      } else {
        next.delete(index)
      }
      state = { ...state, confirmedAttachments: next }
      handle.setSendEnabled(canSend(model, state))
    },
    onBodyToggle(checked) {
      state = { ...state, bodyConfirmed: checked }
      handle.setSendEnabled(canSend(model, state))
    },
    onDelayChange(seconds) {
      delaySeconds = seconds
    },
    onSend() {
      // Pressing Send closes the dialog right away, so the user is not
      // blocked. The wait then runs as a small corner toast that can
      // be cancelled; the send is allowed when it reaches zero.
      closeReview()
      if (delaySeconds <= 0) {
        setStatus(locale === "ja" ? "送信を許可しました。" : "Send allowed.")
        return
      }
      startPendingSend(delaySeconds, locale)
    },
    onCancelSend() {
      cancelPendingSend(locale)
    },
    onBack() {
      setStatus(locale === "ja" ? "編集に戻る判定です。" : "Back to draft selected.")
      closeReview()
    },
  })

  preview.replaceChildren(handle.element)
  openReview()
  handle.setSendEnabled(canSend(model, state))
}

function runReview(): void {
  const config = configFromForm()
  const model = buildReviewModel(snapshotFromForm(), config)
  setStatus(config.fallbackLocale === "ja" ? "確認中です。" : "Reviewing draft.")
  mountReview(model, config.fallbackLocale)
}

function renderShell(): void {
  const initialScenario = firstScenario()
  const root = query<HTMLElement>("#root")
  root.innerHTML = `
    <main class="ml-emulator">
      <section class="ml-panel ml-form-panel" aria-labelledby="emu-title">
        <header class="ml-header">
          <div>
            <p class="ml-kicker">Local emulator</p>
            <h1 id="emu-title">mail-lookout</h1>
          </div>
          <button id="emu-review" class="ml-primary" type="button">Review send</button>
        </header>

        <div class="ml-grid">
          <label>
            Scenario
            <select id="emu-scenario"></select>
          </label>
          <label>
            Locale
            <select id="emu-locale">
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
          <label>
            Delay seconds
            <input id="emu-delay" type="number" min="0" max="600" step="1" value="${defaultConfig.sendDelaySeconds}" />
          </label>
        </div>

        <fieldset class="ml-checks">
          <legend>Required confirmations</legend>
          <label><input id="emu-require-recipients" type="checkbox" checked /> Recipients (each)</label>
          <label><input id="emu-require-attachments" type="checkbox" checked /> Attachments (each)</label>
          <label><input id="emu-require-body" type="checkbox" checked /> Body</label>
        </fieldset>

        <label>
          Subject
          <input id="emu-subject" type="text" />
        </label>
        <p class="ml-hint">
          Recipients: one per line, or separated by <code>,</code> or <code>;</code>. Use
          <code>Name &lt;email&gt;</code> or a bare address.
        </p>
        <label>
          To
          <textarea id="emu-to" rows="3" spellcheck="false" placeholder="Aki Tanaka &lt;aki@example.com&gt;"></textarea>
        </label>
        <label>
          Cc
          <textarea id="emu-cc" rows="2" spellcheck="false" placeholder="jordan@partner.test; sora@vendor.test"></textarea>
        </label>
        <label>
          Bcc
          <textarea id="emu-bcc" rows="2" spellcheck="false" placeholder="review@client.test"></textarea>
        </label>
        <label>
          Attachments
          <textarea id="emu-attachments" rows="3" spellcheck="false" placeholder="proposal.pdf, 120000"></textarea>
        </label>
        <label>
          Body
          <textarea id="emu-body" class="ml-body-input" rows="8"></textarea>
        </label>
      </section>

      <section class="ml-panel ml-preview-panel" aria-labelledby="emu-preview-title">
        <header class="ml-preview-header">
          <h2 id="emu-preview-title">Result</h2>
          <div id="emu-status" class="ml-status" role="status">Ready.</div>
        </header>
        <div class="ml-result-body">
          <div class="ml-result-card">
            <span class="ml-result-label">Current draft</span>
            <strong id="emu-result-subject"></strong>
            <span id="emu-result-meta"></span>
          </div>
        </div>
      </section>
    </main>

    <div id="emu-dialog" class="ml-dialog" role="dialog" aria-modal="true" aria-labelledby="emu-dialog-title" hidden>
      <div class="ml-dialog-backdrop" data-close-review></div>
      <section class="ml-dialog-window">
        <header class="ml-dialog-header">
          <h2 id="emu-dialog-title">Review dialog</h2>
          <button id="emu-close" class="ml-close" type="button" aria-label="Close review">Close</button>
        </header>
        <div id="emu-preview" class="ml-preview"></div>
      </section>
    </div>

    <div id="emu-toast" class="ml-toast" role="status" aria-live="polite" hidden>
      <span id="emu-toast-text" class="ml-toast-text"></span>
      <button id="emu-toast-cancel" class="ml-toast-cancel" type="button">Cancel</button>
    </div>
  `

  const scenarioSelect = query<HTMLSelectElement>("#emu-scenario")
  for (const scenario of scenarios) {
    const option = document.createElement("option")
    option.value = scenario.id
    option.textContent = scenario.label
    scenarioSelect.append(option)
  }

  scenarioSelect.value = initialScenario.id
  fillForm(initialScenario.snapshot)
  updateDraftSummary()
  scenarioSelect.addEventListener("change", () => {
    const selected = scenarios.find(scenario => scenario.id === scenarioSelect.value)
    if (selected) {
      fillForm(selected.snapshot)
      updateDraftSummary()
    }
  })
  query<HTMLButtonElement>("#emu-review").addEventListener("click", runReview)
  query<HTMLButtonElement>("#emu-close").addEventListener("click", closeReview)
  query<HTMLElement>("[data-close-review]").addEventListener("click", closeReview)
  query<HTMLButtonElement>("#emu-toast-cancel").addEventListener("click", () => {
    cancelPendingSend(query<HTMLSelectElement>("#emu-locale").value as LocaleTag)
  })
  for (const selector of ["#emu-subject", "#emu-to", "#emu-cc", "#emu-bcc", "#emu-attachments"]) {
    query<HTMLElement>(selector).addEventListener("input", updateDraftSummary)
  }
}

function updateDraftSummary(): void {
  const snapshot = snapshotFromForm()
  const subject = snapshot.subject.trim().length > 0 ? snapshot.subject : "(No subject)"
  query<HTMLElement>("#emu-result-subject").textContent = subject
  query<HTMLElement>("#emu-result-meta").textContent =
    `${snapshot.recipients.length} recipients, ${snapshot.attachments.length} attachments`
}

renderShell()
