/// <reference types="office-js" />

/**
 * The dialog controller.
 *
 * It runs inside the confirmation dialog. The flow:
 *   1. On ready, register the parent-message handler first.
 *   2. Tell the parent we are ready.
 *   3. Receive the init message with the model and locale.
 *   4. Render the UI and run the send-delay countdown.
 *   5. On send or back, message the decision to the parent.
 *
 * The handler is registered before "ready" is sent, so the parent
 * never messages us before we can listen.
 */

import { canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { getMessages } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import { decodeParentToDialog, encode } from "../shared/messaging"
import { renderDialog } from "./render"

/** Send a decision to the parent and stop. */
function sendDecision(allow: boolean): void {
  Office.context.ui.messageParent(encode({ type: "decision", allow }))
}

/** Handle a message from the parent. */
function onParentMessage(arg: { message: string } | { error: number }): void {
  if (!("message" in arg)) {
    return
  }
  const message = decodeParentToDialog(arg.message)
  if (!message) {
    return
  }
  if (message.type === "init") {
    start(message.model, message.locale)
  }
}

/** Build the UI, wire state, and run the countdown. */
function start(model: ReviewModel, locale: LocaleTag): void {
  const messages = getMessages(locale)
  document.title = messages.dialog.title

  let state: ReviewState = initialReviewState(model)

  // Re-check the send gate and update the button. 
  function refresh(): void {
    handle.setSendEnabled(canSend(model, state))
  }

  const handle = renderDialog(model, messages, {
    onRecipientToggle(index, checked) {
      const next = new Set(state.confirmedRecipients)
      if (checked) {
        next.add(index)
      } else {
        next.delete(index)
      }
      state = { ...state, confirmedRecipients: next }
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
      refresh()
    },
    onBodyToggle(checked) {
      state = { ...state, bodyConfirmed: checked }
      refresh()
    },
    onSend() {
      sendDecision(true)
    },
    onBack() {
      sendDecision(false)
    },
  })

  const root = document.getElementById("root")
  if (root) {
    root.classList.remove("loading")
    root.replaceChildren(handle.element)
  }

  refresh()

  // Run the send-delay countdown. The send button stays off until
  // it reaches zero, then the rest of canSend applies.
  let remaining = model.sendDelaySeconds
  if (remaining > 0) {
    handle.setCountdown(remaining)
    const timer = window.setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        window.clearInterval(timer)
        handle.setCountdown(null)
        state = { ...state, delayElapsed: true }
        refresh()
      } else {
        handle.setCountdown(remaining)
      }
    }, 1000)
  }
}

// Office.onReady returns a promise we do not need to await here.
void Office.onReady(() => {
  // Register the handler before telling the parent we are ready.
  Office.context.ui.addHandlerAsync(
    Office.EventType.DialogParentMessageReceived,
    onParentMessage,
    (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        Office.context.ui.messageParent(encode({ type: "ready" }))
      } else {
        // We cannot receive the model, so cancel to stay safe.
        Office.context.ui.messageParent(encode({ type: "decision", allow: false }))
      }
    },
  )
})
