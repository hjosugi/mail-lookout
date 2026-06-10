/// <reference types="office-js" />

import "../dialog/dialog.css"

import { defaultConfig } from "../config"
import { canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag } from "../i18n"
import { renderDialog } from "../dialog/render"
import { taskPaneMessages, taskPaneRenderOptions } from "../dialog/taskPaneView"
import { buildReviewModel } from "../domain/review"
import { collectSnapshot } from "../office/collect"
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

function start(model: ReviewModel, fingerprint: string, locale: LocaleTag): void {
  const baseMessages = getMessages(locale)
  const messages = taskPaneMessages(baseMessages)
  let state: ReviewState = initialReviewState(model)
  const status = showStatus("")

  // The wait before confirming. Seeded from the model (the configured
  // default) and changeable on the delay control for this send.
  let delaySeconds = model.sendDelaySeconds
  // A single timer drives the pre-confirm countdown.
  let timer: number | null = null
  const stopTimer = (): void => {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  const refresh = (): void => {
    handle.setSendEnabled(canSend(model, state))
  }

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
        status.textContent = ""
        refresh()
      },
      onAttachmentToggle(index, checked) {
        const next = new Set(state.confirmedAttachments)
        if (checked) {
          next.add(index)
        } else {
          next.delete(index)
        }
        state = { ...state, confirmedAttachments: next }
        status.textContent = ""
        refresh()
      },
      onSubjectToggle(checked) {
        state = { ...state, subjectConfirmed: checked }
        status.textContent = ""
        refresh()
      },
      onBodyToggle(checked) {
        state = { ...state, bodyConfirmed: checked }
        status.textContent = ""
        refresh()
      },
      onDelayChange(seconds) {
        delaySeconds = seconds
      },
      onSend() {
        // Record the review so the user's next unchanged Send passes the
        // Smart Alerts check. A 0 delay confirms at once; any positive
        // delay runs a countdown first so the confirm is never skipped.
        const confirm = (): void => {
          rememberConfirmation(fingerprint)
          status.textContent = baseMessages.taskPane.confirmed
        }
        if (delaySeconds <= 0) {
          confirm()
          return
        }
        let remaining = delaySeconds
        handle.setSending(remaining)
        timer = window.setInterval(() => {
          remaining -= 1
          if (remaining <= 0) {
            stopTimer()
            handle.setSending(null)
            confirm()
          } else {
            handle.setSending(remaining)
          }
        }, 1000)
      },
      onCancelSend() {
        stopTimer()
        handle.setSending(null)
        status.textContent = ""
      },
      onBack() {
        stopTimer()
        handle.setSending(null)
        status.textContent = ""
      },
    },
    taskPaneRenderOptions,
  )

  const root = document.getElementById("root")
  if (root) {
    root.classList.remove("loading")
    root.replaceChildren(handle.element)
    handle.element.append(status)
  }

  refresh()
}

void Office.onReady(async () => {
  const config = defaultConfig
  const locale = resolveLocale(Office.context.displayLanguage, config.fallbackLocale)

  try {
    const item = Office.context.mailbox.item as Office.MessageCompose
    const snapshot = await collectSnapshot(item)
    start(buildReviewModel(snapshot, config), snapshotFingerprint(snapshot), locale)
  } catch (error) {
    console.error("mail-lookout: failed to open review task pane", error)
    showError(locale)
  }
})
