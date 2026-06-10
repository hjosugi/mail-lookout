/// <reference types="office-js" />

/**
 * Open the confirmation dialog and wait for a decision.
 *
 * The flow:
 *   1. Open dialog.html with displayDialogAsync.
 *   2. The dialog sends "ready" when it has set up its handler.
 *   3. We send "init" with the model and locale.
 *   4. The dialog sends "decision" with allow true or false.
 *   5. We close the dialog and resolve with that boolean.
 *
 * Opening the dialog is retried a few times because Outlook can be
 * briefly busy around send time. If it still cannot open, the caller
 * falls back to the host's built-in prompt.
 *
 * Any close, error, or user dismissal resolves to false. A
 * cancel is always safe: the message is not sent.
 */

import type { Config } from "../config"
import type { ReviewModel } from "../domain/review"
import type { LocaleTag } from "../i18n/catalog"
import { MessageType, decodeDialogToParent, encode } from "../shared/messaging"

const DIALOG_OPEN_ATTEMPTS = 3
const DIALOG_OPEN_RETRY_DELAY_MS = 250

/** Thrown when the dialog cannot be opened at all. */
export class DialogUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DialogUnavailableError"
  }
}

/**
 * Show the confirmation dialog.
 *
 * Resolves true to send, false to cancel. Rejects with
 * DialogUnavailableError if the dialog cannot open after retries,
 * so the caller can fall back to the built-in prompt.
 */
export function showConfirmationDialog(
  model: ReviewModel,
  locale: LocaleTag,
  config: Config,
  origin: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let attempts = 0

    const openDialog = (): void => {
      attempts += 1

      Office.context.ui.displayDialogAsync(
        `${origin}/dialog.html`,
        {
          width: config.dialog.widthPercent,
          height: config.dialog.heightPercent,
          displayInIframe: config.dialog.displayInIframe,
          promptBeforeOpen: false,
        },
        result => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            if (attempts < DIALOG_OPEN_ATTEMPTS) {
              window.setTimeout(openDialog, DIALOG_OPEN_RETRY_DELAY_MS)
              return
            }
            reject(
              new DialogUnavailableError(
                result.error?.message ?? "The confirmation dialog could not open.",
              ),
            )
            return
          }

          const dialog = result.value
          let settled = false

          // Close the dialog once and resolve with the decision.
          // Guarded so we never resolve twice or close twice.
          const finish = (allow: boolean): void => {
            if (settled) {
              return
            }
            settled = true
            try {
              dialog.close()
            } catch {
              // The dialog may already be closing. Ignore.
            }
            resolve(allow)
          }

          dialog.addEventHandler(Office.EventType.DialogMessageReceived, arg => {
            if (!("message" in arg)) {
              return
            }
            const message = decodeDialogToParent(arg.message)
            if (!message) {
              return
            }
            switch (message.type) {
              case MessageType.Ready:
                dialog.messageChild(encode({ type: MessageType.Init, model, locale }))
                break
              case MessageType.Decision:
                finish(message.allow)
                break
            }
          })

          // Any dialog close or error means cancel, which is safe.
          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            finish(false)
          })
        },
      )
    }

    openDialog()
  })
}
