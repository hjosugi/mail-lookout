/// <reference types="office-js" />

/**
 * The review dialog controller.
 *
 * The task pane opens this page with displayDialogAsync to give the
 * review a roomy, dialog-style surface (the task pane itself is narrow).
 * It renders the same review component, reports each checkbox change back
 * to the parent so progress survives a reopen, and on the primary button
 * sends the decision plus the chosen delay. The countdown and the actual
 * send run in the parent task pane, not here.
 */

import "./dialog.css"

import { canSend } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { getMessages } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import { renderDialog } from "./render"
import { taskPaneMessages } from "./taskPaneView"
import {
  type DialogToParent,
  decodeInit,
  encodeMessage,
  fromSerializable,
  toSerializable,
} from "./dialogMessaging"

function sendToParent(message: DialogToParent): void {
  Office.context.ui.messageParent(encodeMessage(message))
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

function start(model: ReviewModel, locale: LocaleTag, initial: ReviewState): void {
  const messages = taskPaneMessages(getMessages(locale))
  document.title = messages.dialog.title

  let state: ReviewState = initial
  let delaySeconds = model.sendDelaySeconds

  const reportState = (): void => {
    sendToParent({ type: "state", state: toSerializable(state) })
  }
  const refresh = (): void => {
    handle.setSendEnabled(canSend(model, state))
  }

  const handle = renderDialog(
    model,
    messages,
    {
      onRecipientToggle(index, checked) {
        state = { ...state, confirmedRecipients: withIndex(state.confirmedRecipients, index, checked) }
        reportState()
        refresh()
      },
      onAttachmentToggle(index, checked) {
        state = {
          ...state,
          confirmedAttachments: withIndex(state.confirmedAttachments, index, checked),
        }
        reportState()
        refresh()
      },
      onSubjectToggle(checked) {
        state = { ...state, subjectConfirmed: checked }
        reportState()
        refresh()
      },
      onBodyToggle(checked) {
        state = { ...state, bodyConfirmed: checked }
        reportState()
        refresh()
      },
      onDelayChange(seconds) {
        delaySeconds = seconds
      },
      onSend() {
        // Confirm: hand the decision and chosen delay to the parent, which
        // runs the countdown and the send. This dialog then closes.
        sendToParent({ type: "decision", confirm: true, delaySeconds, state: toSerializable(state) })
      },
      onCancelSend() {
        sendToParent({ type: "decision", confirm: false, delaySeconds: 0, state: toSerializable(state) })
      },
      onBack() {
        sendToParent({ type: "decision", confirm: false, delaySeconds: 0, state: toSerializable(state) })
      },
    },
    { showDelayControl: true, showBackButton: true, initialState: state },
  )

  const root = document.getElementById("root")
  if (root) {
    root.classList.remove("loading")
    root.replaceChildren(handle.element)
  }
  refresh()
}

void Office.onReady(() => {
  const init = decodeInit(window.location.hash)
  if (!init) {
    // No payload to render; treat as a cancel so the parent isn't left waiting.
    sendToParent({
      type: "decision",
      confirm: false,
      delaySeconds: 0,
      state: { recipients: [], attachments: [], subject: false, body: false },
    })
    return
  }
  start(init.model, init.locale, fromSerializable(init.state, init.model))
})
