/// <reference types="office-js" />

/**
 * The review task pane.
 *
 * Smart Alerts blocks the send and opens this pane. The whole flow lives
 * here: the user works through the checklist, confirms, the pane runs the
 * send-delay countdown, and at zero it sends the message with
 * item.sendAsync — no second manual Send. Ticked boxes and the countdown
 * deadline are persisted, so closing and reopening the pane resumes.
 *
 * Several messages can wait at once (one per compose window). A banner at
 * the top shows the other messages that are counting down, and the
 * countdown will not start past MAX_PENDING_REVIEWS to keep that bounded.
 */

import "../dialog/dialog.css"

import { loadConfig } from "../office/userSettings"
import { buildReviewModel, canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag } from "../i18n"
import { renderDialog } from "../dialog/render"
import type { DialogCallbacks, DialogHandle } from "../dialog/render"
import { taskPaneMessages, taskPaneRenderOptions } from "../dialog/taskPaneView"
import { collectSnapshot } from "../office/collect"
import {
  MAX_PENDING_REVIEWS,
  clearProgress,
  listWaiting,
  loadProgress,
  saveProgress,
} from "../office/reviewProgress"
import { rememberConfirmation, snapshotFingerprint } from "../office/smartAlert"

interface MiniAction {
  readonly label: string
  readonly kind: "primary" | "secondary" | "danger"
  readonly onClick: () => void
}

/** Build the compact countdown view: a status line, optional note, and buttons. */
function buildMini(statusText: string, actions: readonly MiniAction[], note?: string): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "so-mini"
  const status = document.createElement("p")
  status.className = "so-taskpane-status"
  status.setAttribute("role", "status")
  status.textContent = statusText
  wrap.append(status)
  if (note) {
    const noteEl = document.createElement("p")
    noteEl.className = "so-mini-note"
    noteEl.textContent = note
    wrap.append(noteEl)
  }
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

function start(
  model: ReviewModel,
  fingerprint: string,
  locale: LocaleTag,
  root: HTMLElement,
): void {
  const baseMessages = getMessages(locale)
  const messages = taskPaneMessages(baseMessages)
  const display = { subject: model.subject, recipientCount: model.recipients.length }

  // The banner (other waiting messages) sits above the swappable view.
  const banner = document.createElement("div")
  banner.className = "so-waiting"
  const view = document.createElement("div")

  const restored = loadProgress(model, fingerprint)
  let state: ReviewState = restored?.state ?? initialReviewState(model)
  let deadline: number | null = restored?.deadline ?? null
  let delaySeconds = model.sendDelaySeconds
  let timer: number | null = null
  let handle: DialogHandle | null = null

  const stopTimer = (): void => {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  const persist = (): void => {
    saveProgress(fingerprint, { state, deadline }, display)
  }

  const remaining = (): number =>
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

  // The banner only appears while THIS pane is itself waiting (counting
  // down). On the review/edit screen it's hidden — the focus there is the
  // message being checked, not the others in flight.
  let bannerWaiting = false

  // Refresh the "other messages waiting" banner. The current message is
  // excluded — its own countdown shows in the main view, not here.
  const refreshBanner = (): void => {
    const others = bannerWaiting
      ? listWaiting().filter(item => item.fingerprint !== fingerprint)
      : []
    if (others.length === 0) {
      banner.hidden = true
      banner.replaceChildren()
      return
    }
    banner.hidden = false
    const heading = document.createElement("p")
    heading.className = "so-waiting-title"
    heading.textContent = `${messages.waiting.othersTitle} (${others.length})`
    const list = document.createElement("ul")
    list.className = "so-waiting-list"
    for (const item of others) {
      const row = document.createElement("li")
      row.className = "so-waiting-item"
      const name = document.createElement("span")
      name.className = "so-waiting-subject"
      name.textContent = item.subject.trim() || messages.subject.empty
      const meta = document.createElement("span")
      meta.className = "so-waiting-meta"
      const secs = Math.max(0, Math.ceil((item.deadline - Date.now()) / 1000))
      meta.textContent = `${messages.waiting.recipients(item.recipientCount)} · ${messages.waiting.remaining(formatRemaining(secs))}`
      row.append(name, meta)
      list.append(row)
    }
    banner.replaceChildren(heading, list)
  }

  // Confirm and send. Everything that mutates state runs before sendAsync:
  // it re-fires OnMessageSend, which sees the recorded confirmation, and
  // code after sendAsync is not guaranteed to run.
  const confirmAndSend = (): void => {
    stopTimer()
    bannerWaiting = false
    deadline = null
    rememberConfirmation(fingerprint)
    clearProgress(fingerprint)
    view.replaceChildren(buildMini(baseMessages.taskPane.sending, []))
    const item = Office.context.mailbox.item as Office.MessageCompose
    item.sendAsync({}, result => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        view.replaceChildren(buildMini(baseMessages.taskPane.sendFailed, []))
      }
    })
  }

  const showHolding = (): void => {
    bannerWaiting = true
    refreshBanner()
    view.replaceChildren(
      buildMini(
        `${messages.taskPane.holding} ${formatRemaining(remaining())}`,
        [
          { label: messages.dialog.cancelSend, kind: "danger", onClick: cancelAll },
          { label: messages.dialog.backToEdit, kind: "secondary", onClick: backToReview },
        ],
        messages.waiting.keepOpen,
      ),
    )
  }

  // The send-wait cap is full: don't start another countdown. Let the user
  // retry (a slot may have freed) or step back to the checklist.
  const showCapReached = (): void => {
    bannerWaiting = false
    refreshBanner()
    view.replaceChildren(
      buildMini(messages.waiting.capReached(MAX_PENDING_REVIEWS), [
        {
          label: messages.waiting.retry,
          kind: "primary",
          onClick: () => startCountdown(delaySeconds),
        },
        { label: messages.dialog.backToEdit, kind: "secondary", onClick: backToReview },
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

  function startCountdown(seconds: number): void {
    if (seconds <= 0) {
      confirmAndSend()
      return
    }
    const waiting = listWaiting()
    const alreadyWaiting = waiting.some(item => item.fingerprint === fingerprint)
    if (!alreadyWaiting && waiting.length >= MAX_PENDING_REVIEWS) {
      showCapReached()
      return
    }
    deadline = Date.now() + seconds * 1000
    persist()
    runCountdown()
  }

  // Abandon the review entirely: clear progress and start fresh.
  function cancelAll(): void {
    stopTimer()
    deadline = null
    clearProgress(fingerprint)
    state = initialReviewState(model)
    renderReview()
  }

  // Stop the countdown and return to the checklist, keeping the ticks.
  function backToReview(): void {
    stopTimer()
    deadline = null
    persist()
    renderReview()
  }

  function renderReview(): void {
    bannerWaiting = false
    refreshBanner()
    const callbacks: DialogCallbacks = {
      onRecipientToggle(index, checked) {
        state = {
          ...state,
          confirmedRecipients: withIndex(state.confirmedRecipients, index, checked),
        }
        persist()
        handle?.setSendEnabled(canSend(model, state))
      },
      onAttachmentToggle(index, checked) {
        state = {
          ...state,
          confirmedAttachments: withIndex(state.confirmedAttachments, index, checked),
        }
        persist()
        handle?.setSendEnabled(canSend(model, state))
      },
      onSubjectToggle(checked) {
        state = { ...state, subjectConfirmed: checked }
        persist()
        handle?.setSendEnabled(canSend(model, state))
      },
      onBodyToggle(checked) {
        state = { ...state, bodyConfirmed: checked }
        persist()
        handle?.setSendEnabled(canSend(model, state))
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
    handle = renderDialog(model, messages, callbacks, {
      ...taskPaneRenderOptions,
      initialState: state,
    })
    view.replaceChildren(handle.element)
    handle.setSendEnabled(canSend(model, state))
  }

  // While a countdown is running the send happens here, in this runtime.
  // Refreshing or closing the pane tears it down and the send never fires,
  // so warn before the user leaves. (Browsers show their own generic text;
  // the same warning is also printed under the countdown.)
  window.addEventListener("beforeunload", event => {
    if (deadline !== null) {
      event.preventDefault()
      event.returnValue = baseMessages.waiting.unloadWarning
      return baseMessages.waiting.unloadWarning
    }
    return undefined
  })

  root.classList.remove("loading")
  root.replaceChildren(banner, view)
  refreshBanner()
  window.setInterval(refreshBanner, 1000)
  if (deadline !== null) {
    // A countdown was running when the pane last closed; resume it.
    runCountdown()
  } else {
    renderReview()
  }
}

void Office.onReady(async () => {
  const config = loadConfig()
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
