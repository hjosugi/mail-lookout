import { defaultConfig } from "../config"
import { normalizeEmailAddress } from "../domain/recipients"
import { buildReviewModel, canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import type { Attachment, FieldRecipient, MessageSnapshot, RecipientField } from "../domain/types"
import { getMessages } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import { renderDialog } from "../dialog/render"
import { taskPaneMessages } from "../dialog/taskPaneView"
import { getEmulatorMessages } from "./messages"
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
        recipient("cc", "Jordan Lee", "jordan@partner.test"),
        recipient("cc", "Sora Kim", "sora@vendor.test"),
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

// Drives the post-confirm countdown shown in the result panel.
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

/** The locale currently selected in the emulator form. */
function currentLocale(): LocaleTag {
  return query<HTMLSelectElement>("#emu-locale").value as LocaleTag
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

/** Read a minutes field as a non-negative whole number of seconds. */
function minutesToSeconds(raw: string): number {
  const minutes = Number(raw)
  return Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) * 60 : 0
}

function configFromForm() {
  return {
    ...defaultConfig,
    sendDelaySeconds: minutesToSeconds(query<HTMLInputElement>("#emu-delay").value),
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

/** Clear the auto-dismiss timer for a terminal toast. */
function setStatus(text: string): void {
  query<HTMLElement>("#emu-status").textContent = text
}

/** Format a remaining duration as "M:SS" once past a minute, else "Ns". */
function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`
}

/** Replace the result panel with the draft summary card. */
function renderDraft(): void {
  const messages = getEmulatorMessages(currentLocale())
  const card = document.createElement("div")
  card.className = "ml-result-card"
  const label = document.createElement("span")
  label.className = "ml-result-label"
  label.textContent = messages.draft.label
  const subject = document.createElement("strong")
  subject.id = "emu-result-subject"
  const meta = document.createElement("span")
  meta.id = "emu-result-meta"
  card.append(label, subject, meta)
  query<HTMLElement>("#emu-result-body").replaceChildren(card)
  updateDraftSummary()
}

/** A button shown under the mini countdown. */
interface MiniButton {
  readonly label: string
  readonly kind: "secondary" | "danger"
  readonly onClick: () => void
}

/** Replace the result panel with a status line and optional buttons. */
function renderMini(text: string, buttons: readonly MiniButton[]): void {
  const wrap = document.createElement("div")
  wrap.className = "so-mini"
  const status = document.createElement("p")
  status.className = "so-taskpane-status"
  status.textContent = text
  wrap.append(status)
  if (buttons.length > 0) {
    const row = document.createElement("div")
    row.className = "so-mini-actions"
    for (const button of buttons) {
      const node = document.createElement("button")
      node.type = "button"
      node.className = `so-button so-button-${button.kind}`
      node.textContent = button.label
      node.addEventListener("click", button.onClick)
      row.append(node)
    }
    wrap.append(row)
  }
  query<HTMLElement>("#emu-result-body").replaceChildren(wrap)
}

/**
 * Run the post-confirm countdown in the result panel.
 *
 * The review and the countdown share one surface here, mirroring the
 * task pane: at zero the message is "sent" (the real add-in calls
 * item.sendAsync). Cancel abandons it; Back returns to the review.
 */
function startMini(seconds: number, model: ReviewModel, locale: LocaleTag): void {
  stopTimer()
  const emu = getEmulatorMessages(locale)
  if (seconds <= 0) {
    setStatus(emu.mini.sent)
    renderMini(emu.mini.sent, [])
    return
  }
  let remaining = seconds
  const show = (): void => {
    renderMini(emu.mini.holding(formatCountdown(remaining)), [
      {
        label: emu.mini.backToReview,
        kind: "secondary",
        onClick: () => {
          stopTimer()
          openReview(model, locale)
        },
      },
      {
        label: emu.mini.cancel,
        kind: "danger",
        onClick: () => {
          stopTimer()
          setStatus(emu.status.ready)
          renderDraft()
        },
      },
    ])
  }
  show()
  currentTimer = window.setInterval(() => {
    remaining -= 1
    if (remaining <= 0) {
      stopTimer()
      setStatus(emu.mini.sent)
      renderMini(emu.mini.sent, [])
    } else {
      show()
    }
  }, 1000)
}

/**
 * Render the review inline in the result panel — the emulator's stand-in
 * for the Outlook task pane, where the whole flow lives on one surface.
 * Confirming runs the countdown in the same panel; Back returns to the
 * draft summary.
 */
function openReview(model: ReviewModel, locale: LocaleTag): void {
  stopTimer()
  const messages = taskPaneMessages(getMessages(locale))
  let state: ReviewState = initialReviewState(model)
  let delaySeconds = model.sendDelaySeconds

  const handle = renderDialog(
    model,
    messages,
    {
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
      onSubjectToggle(checked) {
        state = { ...state, subjectConfirmed: checked }
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
        // Confirm: hand off to the countdown on the same surface.
        startMini(delaySeconds, model, locale)
      },
      onCancelSend() {
        // No countdown runs during the review itself.
      },
      onBack() {
        setStatus(getEmulatorMessages(locale).status.ready)
        renderDraft()
      },
    },
    { showDelayControl: true, showBackButton: true, initialState: state },
  )

  query<HTMLElement>("#emu-result-body").replaceChildren(handle.element)
  handle.setSendEnabled(canSend(model, state))
}

function runReview(): void {
  const config = configFromForm()
  const model = buildReviewModel(snapshotFromForm(), config)
  setStatus(getEmulatorMessages(config.fallbackLocale).status.reviewing)
  openReview(model, config.fallbackLocale)
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
            <h1 id="emu-title">Mail Lookout</h1>
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
            Delay minutes
            <input id="emu-delay" type="number" min="0" max="60" step="1" value="${defaultConfig.sendDelaySeconds / 60}" />
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
        <div class="ml-result-body" id="emu-result-body"></div>
      </section>
    </main>

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
  renderDraft()
  setStatus(getEmulatorMessages(currentLocale()).status.ready)

  scenarioSelect.addEventListener("change", () => {
    const selected = scenarios.find(scenario => scenario.id === scenarioSelect.value)
    if (selected) {
      stopTimer()
      fillForm(selected.snapshot)
      renderDraft()
    }
  })
  query<HTMLButtonElement>("#emu-review").addEventListener("click", runReview)
  query<HTMLSelectElement>("#emu-locale").addEventListener("change", renderDraft)
  for (const selector of ["#emu-subject", "#emu-to", "#emu-cc", "#emu-bcc", "#emu-attachments"]) {
    query<HTMLElement>(selector).addEventListener("input", updateDraftSummary)
  }
}

/** Refresh the draft card's text, if it's the panel currently shown. */
function updateDraftSummary(): void {
  const subjectEl = document.getElementById("emu-result-subject")
  const metaEl = document.getElementById("emu-result-meta")
  if (!subjectEl || !metaEl) {
    return
  }
  const messages = getEmulatorMessages(currentLocale())
  const snapshot = snapshotFromForm()
  subjectEl.textContent =
    snapshot.subject.trim().length > 0 ? snapshot.subject : messages.draft.noSubject
  metaEl.textContent = messages.draft.summary(
    snapshot.recipients.length,
    snapshot.attachments.length,
  )
}

renderShell()
