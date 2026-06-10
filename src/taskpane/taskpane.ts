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
      onDelayChange() {
        // The production Smart Alerts flow does not use a countdown.
      },
      onSend() {
        rememberConfirmation(fingerprint)
        status.textContent = baseMessages.taskPane.confirmed
      },
      onCancelSend() {
        // No countdown runs in the task pane.
      },
      onBack() {
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
