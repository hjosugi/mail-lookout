/**
 * Render the confirmation dialog UI.
 *
 * This file builds the DOM by hand. Every piece of user data is
 * written with textContent, never innerHTML, so a crafted name or
 * subject cannot inject markup.
 *
 * It returns a handle with two methods the controller drives:
 * setSendEnabled toggles the send button, and setCountdown shows
 * the remaining delay.
 */

import "./dialog.css"

import type { Messages } from "../i18n/types"
import type {
  AttachmentView,
  RecipientView,
  ReviewModel,
  ReviewState,
  Warning,
  WarningKind,
} from "../domain/review"
import { initialReviewState } from "../domain/review"
import type { RecipientField } from "../domain/types"

/** Props accepted by the element helper. */
interface ElementProps {
  readonly className?: string
  readonly text?: string
  readonly type?: string
  readonly htmlFor?: string
  readonly id?: string
}

/** Create an element with optional props and children. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElementProps,
  children?: readonly (Node | string)[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (props?.className !== undefined) {
    node.className = props.className
  }
  if (props?.text !== undefined) {
    node.textContent = props.text
  }
  if (props?.id !== undefined) {
    node.id = props.id
  }
  if (props?.type !== undefined && node instanceof HTMLInputElement) {
    node.type = props.type
  }
  if (props?.htmlFor !== undefined && node instanceof HTMLLabelElement) {
    node.htmlFor = props.htmlFor
  }
  if (children) {
    for (const child of children) {
      node.append(child)
    }
  }
  return node
}

/** Callbacks the controller passes in to react to user actions. */
export interface DialogCallbacks {
  readonly onRecipientToggle: (index: number, checked: boolean) => void
  readonly onAttachmentToggle: (index: number, checked: boolean) => void
  readonly onSubjectToggle: (checked: boolean) => void
  readonly onBodyToggle: (checked: boolean) => void
  /** The user picked a different wait time before sending. */
  readonly onDelayChange: (seconds: number) => void
  readonly onSend: () => void
  readonly onCancelSend: () => void
  readonly onBack: () => void
}

/** The handle returned by renderDialog. */
export interface DialogHandle {
  readonly element: HTMLElement
  readonly setSendEnabled: (enabled: boolean) => void
  readonly setSending: (seconds: number | null) => void
}

export interface DialogRenderOptions {
  readonly showBackButton?: boolean
  readonly showDelayControl?: boolean
  /**
   * Show the back button only while the countdown is running (as Cancel),
   * not at rest. The task pane uses this: "back to edit" has nowhere to go
   * there, but a cancel during the wait does.
   */
  readonly cancelDuringSendOnly?: boolean
  /** Pre-tick the confirmation checkboxes from restored review progress. */
  readonly initialState?: ReviewState
}

/** Map a warning to its text. Exhaustive over WarningKind. */
function warningText(warning: Warning, messages: Messages): string {
  const kind: WarningKind = warning.kind
  switch (kind) {
    case "emptySubject":
      return messages.warnings.emptySubject
    case "forgottenAttachment":
      return messages.warnings.forgottenAttachment
    case "externalRecipients":
      return messages.warnings.externalRecipients(warning.count)
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

/** Format a byte size for display. Null means unknown. */
function formatSize(sizeBytes: number | null): string {
  if (sizeBytes === null) {
    return ""
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The label for a recipient field. */
function fieldLabel(field: RecipientField, messages: Messages): string {
  switch (field) {
    case "to":
      return messages.fields.to
    case "cc":
      return messages.fields.cc
    case "bcc":
      return messages.fields.bcc
  }
}

/** Build the warnings banner, or null if there are none. */
function buildWarnings(warnings: readonly Warning[], messages: Messages): HTMLElement | null {
  if (warnings.length === 0) {
    return null
  }
  const list = warnings.map(warning =>
    el("li", { className: "so-warning", text: warningText(warning, messages) }),
  )
  return el("ul", { className: "so-warnings" }, list)
}

/** The inner content of a recipient line: badge, name, optional email. */
function recipientContent(recipient: RecipientView, messages: Messages): Node[] {
  const badgeText = recipient.isExternal
    ? messages.recipients.externalBadge
    : messages.recipients.internalBadge
  const badgeClass = recipient.isExternal ? "so-badge so-badge-external" : "so-badge"
  const badge = el("span", { className: badgeClass, text: badgeText })

  const name = recipient.displayName.trim()
  const primary = name.length > 0 ? name : recipient.emailAddress
  const children: Node[] = [badge, el("span", { className: "so-recipient-name", text: primary })]
  // Only show the address as a second line when there is a real name that
  // differs from it — otherwise (no name, or name == address) it just
  // repeats the line above.
  if (name.length > 0 && name.toLowerCase() !== recipient.emailAddress.toLowerCase()) {
    children.push(el("span", { className: "so-recipient-email", text: recipient.emailAddress }))
  }
  return children
}

/** A recipient together with its index in the model's recipient list. */
interface IndexedRecipient {
  readonly recipient: RecipientView
  readonly index: number
}

/**
 * Build one recipient row.
 *
 * When recipient confirmation is required, the row is a checkbox the
 * user must tick one by one. Otherwise it is a static line.
 */
function buildRecipientRow(
  entry: IndexedRecipient,
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
  initial: ReviewState,
): HTMLElement {
  const content = recipientContent(entry.recipient, messages)
  if (model.requireRecipientConfirmation) {
    return buildCheckboxRow(
      "so-recipient so-recipient-check",
      content,
      initial.confirmedRecipients.has(entry.index),
      checked => {
        callbacks.onRecipientToggle(entry.index, checked)
      },
    )
  }
  return el("div", { className: "so-recipient" }, content)
}

/** Build the grouped recipient list for one field. */
function buildFieldGroup(
  field: RecipientField,
  indexed: readonly IndexedRecipient[],
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
  initial: ReviewState,
): HTMLElement | null {
  const inField = indexed.filter(entry => entry.recipient.field === field)
  if (inField.length === 0) {
    return null
  }
  const rows = inField.map(entry => buildRecipientRow(entry, model, messages, callbacks, initial))
  return el("div", { className: "so-field-group" }, [
    el("div", { className: "so-field-label", text: fieldLabel(field, messages) }),
    el("div", { className: "so-field-rows" }, rows),
  ])
}

/** A counter for unique input ids within one dialog render. */
let inputCounter = 0

/** Build a checkbox row bound to a change handler. */
function buildCheckbox(
  labelText: string,
  initialChecked: boolean,
  onToggle: (checked: boolean) => void,
): HTMLElement {
  inputCounter += 1
  const id = `so-check-${inputCounter}`
  const input = el("input", { type: "checkbox", id })
  input.checked = initialChecked
  input.addEventListener("change", () => {
    onToggle(input.checked)
  })
  const label = el("label", { className: "so-check-label", htmlFor: id, text: labelText })
  return el("div", { className: "so-check" }, [input, label])
}

/**
 * Build a checkbox whose label is arbitrary content, not just text.
 *
 * Used for per-recipient and per-attachment rows, where the label is
 * the recipient or file itself. Clicking the row toggles the box.
 */
function buildCheckboxRow(
  className: string,
  content: readonly Node[],
  initialChecked: boolean,
  onToggle: (checked: boolean) => void,
): HTMLElement {
  inputCounter += 1
  const id = `so-check-${inputCounter}`
  const input = el("input", { type: "checkbox", id })
  input.checked = initialChecked
  input.addEventListener("change", () => {
    onToggle(input.checked)
  })
  const label = el("label", { className: "so-check-label", htmlFor: id }, content)
  return el("div", { className }, [input, label])
}

/** Build the recipients section. */
function buildRecipientsSection(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
  initial: ReviewState,
): HTMLElement {
  const children: Node[] = [
    el("h2", { className: "so-section-title", text: messages.sections.recipients }),
  ]

  if (model.recipients.length === 0) {
    children.push(el("p", { className: "so-empty", text: messages.recipients.none }))
  } else {
    if (model.requireRecipientConfirmation) {
      children.push(
        el("p", { className: "so-confirm-hint", text: messages.recipients.confirmHint }),
      )
    }
    const indexed: IndexedRecipient[] = model.recipients.map((recipient, index) => ({
      recipient,
      index,
    }))
    const fields: RecipientField[] = ["to", "cc", "bcc"]
    for (const field of fields) {
      const group = buildFieldGroup(field, indexed, model, messages, callbacks, initial)
      if (group) {
        children.push(group)
      }
    }
  }

  return el("section", { className: "so-section" }, children)
}

/** Build the attachments section. */
function buildAttachmentsSection(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
  initial: ReviewState,
): HTMLElement {
  const children: Node[] = [
    el("h2", { className: "so-section-title", text: messages.sections.attachments }),
  ]

  if (model.attachments.length === 0) {
    children.push(el("p", { className: "so-empty", text: messages.attachments.none }))
  } else {
    if (model.requireAttachmentConfirmation) {
      children.push(
        el("p", { className: "so-confirm-hint", text: messages.attachments.confirmHint }),
      )
    }
    const rows = model.attachments.map((attachment: AttachmentView, index: number) => {
      const size = formatSize(attachment.sizeBytes)
      const content: Node[] = [
        el("span", { className: "so-attachment-name", text: attachment.name }),
      ]
      if (size.length > 0) {
        content.push(el("span", { className: "so-attachment-size", text: size }))
      }
      if (model.requireAttachmentConfirmation) {
        return buildCheckboxRow(
          "so-attachment so-attachment-check",
          content,
          initial.confirmedAttachments.has(index),
          checked => {
            callbacks.onAttachmentToggle(index, checked)
          },
        )
      }
      return el("div", { className: "so-attachment" }, content)
    })
    children.push(el("div", { className: "so-attachment-list" }, rows))
  }

  return el("section", { className: "so-section" }, children)
}

/** Build the subject section. */
function buildSubjectSection(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
  initial: ReviewState,
): HTMLElement {
  const subjectText = model.subject.trim().length > 0 ? model.subject : messages.subject.empty
  const children: Node[] = [
    el("h2", { className: "so-section-title", text: messages.sections.subject }),
    el("p", { className: "so-subject", text: subjectText }),
  ]
  if (model.requireSubjectConfirmation) {
    children.push(
      buildCheckbox(messages.subject.confirmEmpty, initial.subjectConfirmed, checked => {
        callbacks.onSubjectToggle(checked)
      }),
    )
  }
  return el("section", { className: "so-section" }, children)
}

/** Build the body section. */
function buildBodySection(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
  initial: ReviewState,
): HTMLElement {
  const previewText = model.bodyPreview.length > 0 ? model.bodyPreview : messages.body.empty
  // A read-only textarea, not a <p>: it gives the body its own
  // bounded, scrollable box and keeps every line break visible, so
  // it reads like the message rather than a wrapped paragraph. Still
  // filled with textContent, so it stays injection-safe.
  const bodyField = el("textarea", { className: "so-body", text: previewText })
  bodyField.readOnly = true
  bodyField.rows = 6
  bodyField.setAttribute("aria-label", messages.sections.body)
  const children: Node[] = [
    el("h2", { className: "so-section-title", text: messages.sections.body }),
    bodyField,
  ]
  if (model.requireBodyConfirmation) {
    children.push(
      buildCheckbox(messages.body.confirm, initial.bodyConfirmed, checked => {
        callbacks.onBodyToggle(checked)
      }),
    )
  }
  return el("section", { className: "so-section" }, children)
}

/**
 * Build the "wait before sending" control: a free-form minutes input.
 *
 * The user types how many minutes to wait, right on the confirmation
 * screen; 0 means send immediately. The model stores seconds, so we
 * convert minutes on the way in and out.
 */
function buildDelayControl(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
): HTMLElement {
  const input = el("input", { type: "number", className: "so-delay-input" })
  input.min = "0"
  input.step = "1"
  input.value = String(Math.round(model.sendDelaySeconds / 60))
  input.setAttribute("aria-label", messages.dialog.delayLabel)
  input.title = messages.dialog.delayImmediateHint
  input.addEventListener("change", () => {
    const raw = Number(input.value)
    const minutes = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
    input.value = String(minutes)
    callbacks.onDelayChange(minutes * 60)
  })
  return el("div", { className: "so-delay" }, [
    el("span", { className: "so-delay-label", text: messages.dialog.delayLabel }),
    input,
    el("span", { className: "so-delay-unit", text: messages.dialog.delayUnitMinutes }),
  ])
}

/**
 * Render the dialog and return a handle.
 *
 * The handle lets the controller enable the send button and
 * update the countdown without touching the DOM directly.
 */
export function renderDialog(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
  options: DialogRenderOptions = {},
): DialogHandle {
  inputCounter = 0
  const showBackButton = options.showBackButton ?? true
  const showDelayControl = options.showDelayControl ?? true
  const cancelDuringSendOnly = options.cancelDuringSendOnly ?? false

  let baseEnabled = false
  // Non-null while the post-click send countdown is running. Send is
  // no longer gated by the delay; the countdown runs after the user
  // presses Send and can be cancelled.
  let sendingSeconds: number | null = null

  const sendBtn = el("button", {
    className: "so-button so-button-primary",
    type: "button",
    text: messages.dialog.sendNow,
  })
  const backBtn = el("button", {
    className: "so-button so-button-secondary",
    type: "button",
    text: messages.dialog.backToEdit,
  })

  const updateButtons = (): void => {
    const sending = sendingSeconds !== null
    sendBtn.disabled = sending || !baseEnabled
    sendBtn.textContent = sending
      ? messages.dialog.sendingInSeconds(sendingSeconds ?? 0)
      : messages.dialog.sendNow
    backBtn.textContent = sending ? messages.dialog.cancelSend : messages.dialog.backToEdit
    // While sending, the back button is the cancel: make it read as a
    // stop action, not a neutral one.
    backBtn.classList.toggle("so-button-danger", sending)
    // In cancel-only mode the back button is hidden until the countdown
    // runs, so it never shows a pointless "back to edit" at rest.
    backBtn.hidden = cancelDuringSendOnly && !sending
  }

  sendBtn.addEventListener("click", () => {
    if (sendingSeconds === null && baseEnabled) {
      callbacks.onSend()
    }
  })
  backBtn.addEventListener("click", () => {
    if (sendingSeconds !== null) {
      callbacks.onCancelSend()
    } else {
      callbacks.onBack()
    }
  })

  const header = el("header", { className: "so-header" }, [
    el("h1", { className: "so-title", text: messages.dialog.title }),
    el("p", { className: "so-intro", text: messages.dialog.intro }),
  ])

  const body = el("div", { className: "so-body-content" })
  const warningsBanner = buildWarnings(model.warnings, messages)
  if (warningsBanner) {
    body.append(warningsBanner)
  }
  // Checkboxes render pre-ticked from any restored progress, so a reopened
  // review picks up exactly where it was left.
  const initial = options.initialState ?? initialReviewState(model)
  body.append(
    buildRecipientsSection(model, messages, callbacks, initial),
    buildAttachmentsSection(model, messages, callbacks, initial),
    buildSubjectSection(model, messages, callbacks, initial),
    buildBodySection(model, messages, callbacks, initial),
  )

  const footerChildren: Node[] = []
  if (showDelayControl) {
    footerChildren.push(buildDelayControl(model, messages, callbacks))
  }
  const footerActions = showBackButton ? [backBtn, sendBtn] : [sendBtn]
  footerChildren.push(el("div", { className: "so-footer-actions" }, footerActions))
  const footer = el("footer", { className: "so-footer" }, footerChildren)

  const element = el("div", { className: "so-dialog" }, [header, body, footer])

  updateButtons()

  return {
    element,
    setSendEnabled(enabled: boolean): void {
      baseEnabled = enabled
      updateButtons()
    },
    setSending(seconds: number | null): void {
      sendingSeconds = seconds
      updateButtons()
    },
  }
}
