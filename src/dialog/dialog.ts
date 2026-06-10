/// <reference types="office-js" />

/**
 * The dialog controller.
 *
 * It runs inside the confirmation dialog. The flow:
 *   1. Read the init message from the URL hash.
 *   2. Render the UI. On Send, run a cancellable countdown.
 *   3. On send or back, message the decision to the parent.
 */

import { canSend, initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { getMessages } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"
import { MessageType, decodeParentToDialog, encode } from "../shared/messaging"
import type { ParentToDialog } from "../shared/messaging"
import { renderDialog } from "./render"

/** Send a decision to the parent and stop. */
function sendDecision(allow: boolean): void {
  Office.context.ui.messageParent(encode({ type: MessageType.Decision, allow }))
}

function readInitMessage(): ParentToDialog | null {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const init = params.get("init")
  if (!init) {
    return null
  }
  return decodeParentToDialog(init)
}

/** Build the UI, wire state, and run the countdown. */
function start(model: ReviewModel, locale: LocaleTag): void {
  const messages = getMessages(locale)
  document.title = messages.dialog.title

  let state: ReviewState = initialReviewState(model)
  let sendTimer: number | null = null
  // The wait before sending. Seeded from config, but the user can
  // change it on the confirmation screen, so it lives here, not in
  // the immutable model.
  let delaySeconds = model.sendDelaySeconds

  function clearSendTimer(): void {
    if (sendTimer !== null) {
      window.clearInterval(sendTimer)
      sendTimer = null
    }
  }

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
    onSubjectToggle(checked) {
      state = { ...state, subjectConfirmed: checked }
      refresh()
    },
    onBodyToggle(checked) {
      state = { ...state, bodyConfirmed: checked }
      refresh()
    },
    onDelayChange(seconds) {
      delaySeconds = seconds
    },
    onSend() {
      // The delay runs here, after the user presses Send: a
      // cancellable countdown, then the decision goes out.
      if (delaySeconds <= 0) {
        sendDecision(true)
        return
      }
      let remaining = delaySeconds
      handle.setSending(remaining)
      sendTimer = window.setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearSendTimer()
          sendDecision(true)
        } else {
          handle.setSending(remaining)
        }
      }, 1000)
    },
    onCancelSend() {
      clearSendTimer()
      handle.setSending(null)
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
}

// Office.onReady returns a promise we do not need to await here.
void Office.onReady(() => {
  const message = readInitMessage()
  if (message) {
    start(message.model, message.locale)
  } else {
    sendDecision(false)
  }
})
