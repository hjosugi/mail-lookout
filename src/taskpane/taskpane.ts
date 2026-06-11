/// <reference types="office-js" />

import "../dialog/dialog.css"

import { defaultConfig } from "../config"
import { buildReviewModel, canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag } from "../i18n"
import { renderDialog } from "../dialog/render"
import type { DialogCallbacks, DialogHandle } from "../dialog/render"
import { taskPaneMessages, taskPaneRenderOptions } from "../dialog/taskPaneView"
import { collectSnapshot } from "../office/collect"
import { clearProgress, loadProgress, saveProgress } from "../office/reviewProgress"
import { rememberConfirmation, snapshotFingerprint } from "../office/smartAlert"

function showStatus(text: string): HTMLElement {
  const status = document.createElement("p")
  status.className = "so-taskpane-status"
  status.setAttribute("role", "status")
  status.textContent = text
  return status
}

function showError(locale: LocaleTag): void {
  const messages = getMessages(locale)
  const root = document.getElementById("root")
  if (!root) {
    return
  }
  root.classList.remove("loading")
  root.replaceChildren(showStatus(messages.taskPane.loadFailed))
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

function start(model: ReviewModel, fingerprint: string, locale: LocaleTag, root: HTMLElement): void {
  const baseMessages = getMessages(locale)
  const messages = taskPaneMessages(baseMessages)
  const status = showStatus("")

  // Pick up any progress left from a previous open of this same draft:
  // the checks already ticked and the countdown deadline.
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
    saveProgress(fingerprint, { state, deadline })
  }

  const refresh = (): void => {
    handle?.setSendEnabled(canSend(model, state))
  }

  // Confirm the review: stop the wait, record it so the next unchanged
  // Send passes the Smart Alerts check, and drop the saved progress.
  const confirmReview = (): void => {
    stopTimer()
    deadline = null
    handle?.setSending(null)
    rememberConfirmation(fingerprint)
    clearProgress()
    status.textContent = baseMessages.taskPane.confirmed
  }

  // One countdown step, driven by the wall-clock deadline so closing and
  // reopening the pane resumes — or, if the deadline already passed while
  // it was closed, confirms straight away.
  const tick = (): void => {
    if (deadline === null) {
      return
    }
    const remaining = Math.ceil((deadline - Date.now()) / 1000)
    if (remaining <= 0) {
      confirmReview()
    } else {
      handle?.setSending(remaining)
    }
  }

  const runCountdown = (): void => {
    status.textContent = baseMessages.taskPane.holding
    tick()
    if (deadline !== null && timer === null) {
      timer = window.setInterval(tick, 1000)
    }
  }

  // Cancel abandons the review: drop the saved progress and re-render a
  // fresh, unchecked pane.
  const cancel = (): void => {
    stopTimer()
    deadline = null
    clearProgress()
    state = initialReviewState(model)
    mount()
    status.textContent = ""
  }

  const callbacks: DialogCallbacks = {
    onRecipientToggle(index, checked) {
      state = { ...state, confirmedRecipients: withIndex(state.confirmedRecipients, index, checked) }
      status.textContent = ""
      persist()
      refresh()
    },
    onAttachmentToggle(index, checked) {
      state = {
        ...state,
        confirmedAttachments: withIndex(state.confirmedAttachments, index, checked),
      }
      status.textContent = ""
      persist()
      refresh()
    },
    onSubjectToggle(checked) {
      state = { ...state, subjectConfirmed: checked }
      status.textContent = ""
      persist()
      refresh()
    },
    onBodyToggle(checked) {
      state = { ...state, bodyConfirmed: checked }
      status.textContent = ""
      persist()
      refresh()
    },
    onDelayChange(seconds) {
      delaySeconds = seconds
    },
    onSend() {
      // A 0 delay confirms at once; any positive delay starts a wall-clock
      // countdown that confirms when it reaches zero.
      if (delaySeconds <= 0) {
        confirmReview()
        return
      }
      deadline = Date.now() + delaySeconds * 1000
      persist()
      runCountdown()
    },
    onCancelSend() {
      cancel()
    },
    onBack() {
      cancel()
    },
  }

  function mount(): void {
    handle = renderDialog(model, messages, callbacks, {
      ...taskPaneRenderOptions,
      initialState: state,
    })
    root.replaceChildren(handle.element)
    handle.element.append(status)
    refresh()
  }

  root.classList.remove("loading")
  mount()
  // Resume a countdown that was already running when the pane last closed.
  if (deadline !== null) {
    runCountdown()
  }
}

void Office.onReady(async () => {
  const config = defaultConfig
  const locale = resolveLocale(Office.context.displayLanguage, config.fallbackLocale)

  try {
    const item = Office.context.mailbox.item as Office.MessageCompose
    const snapshot = await collectSnapshot(item)
    const root = document.getElementById("root")
    if (!root) {
      return
    }
    start(buildReviewModel(snapshot, config), snapshotFingerprint(snapshot), locale, root)
  } catch (error) {
    console.error("mail-lookout: failed to open review task pane", error)
    showError(locale)
  }
})
