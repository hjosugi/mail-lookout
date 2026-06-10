/**
 * Task pane presentation of the review UI.
 *
 * The task pane reuses the same renderDialog component as the popup
 * dialog and the emulator, but with task-pane wording (no "send", just
 * "mark reviewed") and without the back button or send-delay control.
 * Keeping this mapping here, as a pure function, lets both the Outlook
 * task pane and the local emulator render an identical preview.
 */

import type { DialogRenderOptions } from "./render"
import type { Messages } from "../i18n/types"

/** Render options that match how the Outlook task pane mounts the dialog. */
export const taskPaneRenderOptions: DialogRenderOptions = {
  showBackButton: false,
  showDelayControl: false,
}

/**
 * Re-label the dialog strings for the task pane.
 *
 * The task pane is not a send surface: pressing the primary button only
 * marks the review as done. So the title, intro, and primary button text
 * come from the taskPane catalog section instead of the dialog one.
 */
export function taskPaneMessages(messages: Messages): Messages {
  return {
    ...messages,
    dialog: {
      ...messages.dialog,
      title: messages.taskPane.title,
      intro: messages.taskPane.intro,
      sendNow: messages.taskPane.confirm,
    },
  }
}
