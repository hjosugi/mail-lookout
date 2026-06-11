/// <reference types="office-js" />

/**
 * The review task pane.
 *
 * The pane is a narrow, persistent surface. It opens the roomy review
 * dialog (dialog.html) with displayDialogAsync, takes the user's decision
 * back, then runs the send-delay countdown itself and finally sends the
 * message with item.sendAsync. Keeping the countdown and the send here —
 * not in the dialog — lets the dialog close while the countdown stays
 * visible in the pane, and survives the pane being closed and reopened.
 *
 * If the dialog can't open (older host, blocked), the pane falls back to
 * rendering the review inline.
 */

import "../dialog/dialog.css"

import { defaultConfig } from "../config"
import { buildReviewModel, canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag } from "../i18n"
import { renderDialog } from "../dialog/render"
import type { DialogCallbacks, DialogHandle } from "../dialog/render"
import { taskPaneMessages, taskPaneRenderOptions } from "../dialog/taskPaneView"
import type { DialogInit } from "../dialog/dialogMessaging"
import { decodeMessage, encodeInit, fromSerializable, toSerializable } from "../dialog/dialogMessaging"
import { collectSnapshot } from "../office/collect"
import { clearProgress, loadProgress, saveProgress } from "../office/reviewProgress"
import { rememberConfirmation, snapshotFingerprint } from "../office/smartAlert"

interface MiniAction {
  readonly label: string
  readonly kind: "primary" | "secondary" | "danger"
  readonly onClick: () => void
}

/** Build the compact pane view: a status line and optional action buttons. */
function buildMini(statusText: string, actions: readonly MiniAction[]): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "so-mini"
  const status = document.createElement("p")
  status.className = "so-taskpane-status"
  status.setAttribute("role", "status")
  status.textContent = statusText
  wrap.append(status)
  if (actions.length > 0) {
    const row = document.createElement("div")
    row.className = "so-mini-actions"
    for (const action of actions) {
      const button = document.createElement("button")
      button.type = "button"
      button.className = `so-button so-button-${action.kind}`
      button.textContent = action.label
      button.addEventListener("click", action.onClick)
      row.append(button)
    }
    wrap.append(row)
  }
  return wrap
}

/** Format a remaining duration as "M:SS" once past a minute, else "Ns". */
function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`
}

/** Add or remove an index from a confirmation set, returning a new set. */
function withIndex(set: ReadonlySet<number>, index: number, present: boolean): Set<number> {
  const next = new Set(set)
  if (present) {
    next.add(index)
  } else {
    next.delete(index)
  }
  return next
}

function showError(locale: LocaleTag, root: HTMLElement): void {
  const messages = getMessages(locale)
  root.classList.remove("loading")
  root.replaceChildren(buildMini(messages.taskPane.loadFailed, []))
}

function start(model: ReviewModel, fingerprint: string, locale: LocaleTag, root: HTMLElement): void {
  const baseMessages = getMessages(locale)
  const messages = taskPaneMessages(baseMessages)

  const restored = loadProgress(model, fingerprint)
  let state: ReviewState = restored?.state ?? initialReviewState(model)
  let deadline: number | null = restored?.deadline ?? null
  let delaySeconds = model.sendDelaySeconds
  let timer: number | null = null
  let dialog: Office.Dialog | null = null

  const stopTimer = (): void => {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  const persist = (): void => {
    saveProgress(fingerprint, { state, deadline })
  }

  const closeDialog = (): void => {
    if (dialog) {
      try {
        dialog.close()
      } catch {
        // Already closed; nothing to do.
      }
      dialog = null
    }
  }

  const remaining = (): number =>
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

  // Confirm and send. Everything that mutates state runs before sendAsync,
  // since the re-fired OnMessageSend sees the recorded confirmation and
  // code after sendAsync is not guaranteed to run.
  const confirmAndSend = (): void => {
    stopTimer()
    deadline = null
    rememberConfirmation(fingerprint)
    clearProgress()
    root.replaceChildren(buildMini(baseMessages.taskPane.sending, []))
    const item = Office.context.mailbox.item as Office.MessageCompose
    item.sendAsync({}, result => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        root.replaceChildren(buildMini(baseMessages.taskPane.sendFailed, []))
      }
    })
  }

  const showHolding = (): void => {
    root.replaceChildren(
      buildMini(`${messages.taskPane.holding} ${formatRemaining(remaining())}`, [
        { label: messages.dialog.cancelSend, kind: "danger", onClick: cancelAll },
        { label: messages.dialog.backToEdit, kind: "secondary", onClick: backToReview },
      ]),
    )
  }

  const showIdle = (): void => {
    root.replaceChildren(
      buildMini(messages.taskPane.intro, [
        { label: messages.taskPane.confirm, kind: "primary", onClick: openReview },
      ]),
    )
  }

  const tick = (): void => {
    if (deadline === null) {
      return
    }
    if (remaining() <= 0) {
      confirmAndSend()
    } else {
      showHolding()
    }
  }

  const runCountdown = (): void => {
    stopTimer()
    tick()
    if (deadline !== null) {
      timer = window.setInterval(tick, 1000)
    }
  }

  const startCountdown = (seconds: number): void => {
    if (seconds <= 0) {
      confirmAndSend()
      return
    }
    deadline = Date.now() + seconds * 1000
    persist()
    runCountdown()
  }

  // Abandon the review entirely: clear progress and return to idle.
  function cancelAll(): void {
    stopTimer()
    deadline = null
    clearProgress()
    state = initialReviewState(model)
    closeDialog()
    showIdle()
  }

  // Stop the countdown and reopen the review, keeping the ticked boxes.
  function backToReview(): void {
    stopTimer()
    deadline = null
    persist()
    openReview()
  }

  function onDialogMessage(arg: { message: string; origin: string | undefined } | { error: number }): void {
    if (!("message" in arg)) {
      return
    }
    const message = decodeMessage(arg.message)
    if (!message) {
      return
    }
    if (message.type === "state") {
      state = fromSerializable(message.state, model)
      persist()
      return
    }
    // decision
    state = fromSerializable(message.state, model)
    closeDialog()
    if (message.confirm) {
      startCountdown(message.delaySeconds)
    } else {
      cancelAll()
    }
  }

  function onDialogClosed(): void {
    // The dialog window was closed or unloaded without a decision message.
    dialog = null
    if (deadline !== null) {
      runCountdown()
    } else {
      showIdle()
    }
  }

  // Render the review inline in the pane. Used when the dialog can't open.
  let inlineHandle: DialogHandle | null = null
  function renderInlineReview(): void {
    const callbacks: DialogCallbacks = {
      onRecipientToggle(index, checked) {
        state = { ...state, confirmedRecipients: withIndex(state.confirmedRecipients, index, checked) }
        persist()
        inlineHandle?.setSendEnabled(canSend(model, state))
      },
      onAttachmentToggle(index, checked) {
        state = {
          ...state,
          confirmedAttachments: withIndex(state.confirmedAttachments, index, checked),
        }
        persist()
        inlineHandle?.setSendEnabled(canSend(model, state))
      },
      onSubjectToggle(checked) {
        state = { ...state, subjectConfirmed: checked }
        persist()
        inlineHandle?.setSendEnabled(canSend(model, state))
      },
      onBodyToggle(checked) {
        state = { ...state, bodyConfirmed: checked }
        persist()
        inlineHandle?.setSendEnabled(canSend(model, state))
      },
      onDelayChange(seconds) {
        delaySeconds = seconds
      },
      onSend() {
        startCountdown(delaySeconds)
      },
      onCancelSend: cancelAll,
      onBack: cancelAll,
    }
    inlineHandle = renderDialog(model, messages, callbacks, {
      ...taskPaneRenderOptions,
      initialState: state,
    })
    root.replaceChildren(inlineHandle.element)
    inlineHandle.setSendEnabled(canSend(model, state))
  }

  function openReview(): void {
    closeDialog()
    const init: DialogInit = { model, locale, state: toSerializable(state) }
    const url = `${new URL("dialog.html", window.location.href).href}#init=${encodeInit(init)}`
    // While the dialog is open the pane sits behind it; keep a reopen path
    // in case the dialog is dismissed.
    root.replaceChildren(
      buildMini(messages.taskPane.title, [
        { label: messages.taskPane.confirm, kind: "primary", onClick: openReview },
      ]),
    )
    try {
      Office.context.ui.displayDialogAsync(url, { height: 75, width: 50 }, result => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          renderInlineReview()
          return
        }
        dialog = result.value
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, onDialogMessage)
        dialog.addEventHandler(Office.EventType.DialogEventReceived, onDialogClosed)
      })
    } catch {
      renderInlineReview()
    }
  }

  root.classList.remove("loading")
  if (deadline !== null) {
    // A countdown was running when the pane last closed; resume it.
    runCountdown()
  } else {
    openReview()
  }
}

void Office.onReady(async () => {
  const config = defaultConfig
  const locale = resolveLocale(Office.context.displayLanguage, config.fallbackLocale)
  const root = document.getElementById("root")
  if (!root) {
    return
  }

  try {
    const item = Office.context.mailbox.item as Office.MessageCompose
    const snapshot = await collectSnapshot(item)
    start(buildReviewModel(snapshot, config), snapshotFingerprint(snapshot), locale, root)
  } catch (error) {
    console.error("mail-lookout: failed to open review task pane", error)
    showError(locale, root)
  }
})
