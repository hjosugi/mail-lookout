/**
 * Render the confirmation dialog UI.
 *
 * This file builds the DOM by hand. Every piece of user data is
 * written with textContent, never innerHTML, so a crafted name or
 * subject cannot inject markup.
 *
 * It returns a handle with two methods the controller drives:
 * setSendEnabled toggles the send button, and setCountdown shows
 * the remaining delay.
 */

import "./dialog.css";

import type { Messages } from "../i18n/types";
import type {
  AttachmentView,
  RecipientView,
  ReviewModel,
  Warning,
  WarningKind,
} from "../domain/review";
import type { RecipientField } from "../domain/types";

/** Props accepted by the element helper. */
interface ElementProps {
  readonly className?: string;
  readonly text?: string;
  readonly type?: string;
  readonly htmlFor?: string;
  readonly id?: string;
}

/** Create an element with optional props and children. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElementProps,
  children?: readonly (Node | string)[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props?.className !== undefined) {
    node.className = props.className;
  }
  if (props?.text !== undefined) {
    node.textContent = props.text;
  }
  if (props?.id !== undefined) {
    node.id = props.id;
  }
  if (props?.type !== undefined && node instanceof HTMLInputElement) {
    node.type = props.type;
  }
  if (props?.htmlFor !== undefined && node instanceof HTMLLabelElement) {
    node.htmlFor = props.htmlFor;
  }
  if (children) {
    for (const child of children) {
      node.append(child);
    }
  }
  return node;
}

/** Callbacks the controller passes in to react to user actions. */
export interface DialogCallbacks {
  readonly onExternalToggle: (email: string, checked: boolean) => void;
  readonly onAttachmentsToggle: (checked: boolean) => void;
  readonly onBodyToggle: (checked: boolean) => void;
  readonly onSend: () => void;
  readonly onBack: () => void;
}

/** The handle returned by renderDialog. */
export interface DialogHandle {
  readonly element: HTMLElement;
  readonly setSendEnabled: (enabled: boolean) => void;
  readonly setCountdown: (seconds: number | null) => void;
}

/** Map a warning to its text. Exhaustive over WarningKind. */
function warningText(warning: Warning, messages: Messages): string {
  const kind: WarningKind = warning.kind;
  switch (kind) {
    case "emptySubject":
      return messages.warnings.emptySubject;
    case "forgottenAttachment":
      return messages.warnings.forgottenAttachment;
    case "externalRecipients":
      return messages.warnings.externalRecipients(warning.count);
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/** Format a byte size for display. Null means unknown. */
function formatSize(sizeBytes: number | null): string {
  if (sizeBytes === null) {
    return "";
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The label for a recipient field. */
function fieldLabel(field: RecipientField, messages: Messages): string {
  switch (field) {
    case "to":
      return messages.fields.to;
    case "cc":
      return messages.fields.cc;
    case "bcc":
      return messages.fields.bcc;
  }
}

/** Build the warnings banner, or null if there are none. */
function buildWarnings(warnings: readonly Warning[], messages: Messages): HTMLElement | null {
  if (warnings.length === 0) {
    return null;
  }
  const list = warnings.map((warning) =>
    el("li", { className: "so-warning", text: warningText(warning, messages) }),
  );
  return el("ul", { className: "so-warnings" }, list);
}

/** Build one recipient row. */
function buildRecipientRow(recipient: RecipientView, messages: Messages): HTMLElement {
  const badgeText = recipient.isExternal
    ? messages.recipients.externalBadge
    : messages.recipients.internalBadge;
  const badgeClass = recipient.isExternal ? "so-badge so-badge-external" : "so-badge";
  const badge = el("span", { className: badgeClass, text: badgeText });

  const name = recipient.displayName.trim();
  const primary = name.length > 0 ? name : recipient.emailAddress;
  const nameEl = el("span", { className: "so-recipient-name", text: primary });

  const children: Node[] = [badge, nameEl];
  if (name.length > 0) {
    children.push(el("span", { className: "so-recipient-email", text: recipient.emailAddress }));
  }
  return el("div", { className: "so-recipient" }, children);
}

/** Build the grouped recipient list for one field. */
function buildFieldGroup(
  field: RecipientField,
  recipients: readonly RecipientView[],
  messages: Messages,
): HTMLElement | null {
  const inField = recipients.filter((recipient) => recipient.field === field);
  if (inField.length === 0) {
    return null;
  }
  const rows = inField.map((recipient) => buildRecipientRow(recipient, messages));
  return el("div", { className: "so-field-group" }, [
    el("div", { className: "so-field-label", text: fieldLabel(field, messages) }),
    el("div", { className: "so-field-rows" }, rows),
  ]);
}

/** A counter for unique input ids within one dialog render. */
let inputCounter = 0;

/** Build a checkbox row bound to a change handler. */
function buildCheckbox(labelText: string, onToggle: (checked: boolean) => void): HTMLElement {
  inputCounter += 1;
  const id = `so-check-${inputCounter}`;
  const input = el("input", { type: "checkbox", id });
  input.addEventListener("change", () => {
    onToggle(input.checked);
  });
  const label = el("label", { className: "so-check-label", htmlFor: id, text: labelText });
  return el("div", { className: "so-check" }, [input, label]);
}

/** Build the recipients section. */
function buildRecipientsSection(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
): HTMLElement {
  const children: Node[] = [
    el("h2", { className: "so-section-title", text: messages.sections.recipients }),
  ];

  if (model.recipients.length === 0) {
    children.push(el("p", { className: "so-empty", text: messages.recipients.none }));
  } else {
    const fields: RecipientField[] = ["to", "cc", "bcc"];
    for (const field of fields) {
      const group = buildFieldGroup(field, model.recipients, messages);
      if (group) {
        children.push(group);
      }
    }
  }

  if (model.requireExternalRecipientConfirmation) {
    const confirmList = el(
      "div",
      { className: "so-confirm-list" },
      model.externalEmails.map((email) =>
        buildCheckbox(`${messages.recipients.confirmExternal}: ${email}`, (checked) => {
          callbacks.onExternalToggle(email, checked);
        }),
      ),
    );
    children.push(confirmList);
  }

  return el("section", { className: "so-section" }, children);
}

/** Build the attachments section. */
function buildAttachmentsSection(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
): HTMLElement {
  const children: Node[] = [
    el("h2", { className: "so-section-title", text: messages.sections.attachments }),
  ];

  if (model.attachments.length === 0) {
    children.push(el("p", { className: "so-empty", text: messages.attachments.none }));
  } else {
    const rows = model.attachments.map((attachment: AttachmentView) => {
      const size = formatSize(attachment.sizeBytes);
      const rowChildren: Node[] = [
        el("span", { className: "so-attachment-name", text: attachment.name }),
      ];
      if (size.length > 0) {
        rowChildren.push(el("span", { className: "so-attachment-size", text: size }));
      }
      return el("div", { className: "so-attachment" }, rowChildren);
    });
    children.push(el("div", { className: "so-attachment-list" }, rows));

    if (model.requireAttachmentConfirmation) {
      children.push(
        buildCheckbox(messages.attachments.confirm, (checked) => {
          callbacks.onAttachmentsToggle(checked);
        }),
      );
    }
  }

  return el("section", { className: "so-section" }, children);
}

/** Build the subject section. */
function buildSubjectSection(model: ReviewModel, messages: Messages): HTMLElement {
  return el("section", { className: "so-section" }, [
    el("h2", { className: "so-section-title", text: messages.sections.subject }),
    el("p", { className: "so-subject", text: model.subject }),
  ]);
}

/** Build the body section. */
function buildBodySection(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
): HTMLElement {
  const previewText = model.bodyPreview.length > 0 ? model.bodyPreview : messages.body.empty;
  const children: Node[] = [
    el("h2", { className: "so-section-title", text: messages.sections.body }),
    el("p", { className: "so-body", text: previewText }),
  ];
  if (model.requireBodyConfirmation) {
    children.push(
      buildCheckbox(messages.body.confirm, (checked) => {
        callbacks.onBodyToggle(checked);
      }),
    );
  }
  return el("section", { className: "so-section" }, children);
}

/**
 * Render the dialog and return a handle.
 *
 * The handle lets the controller enable the send button and
 * update the countdown without touching the DOM directly.
 */
export function renderDialog(
  model: ReviewModel,
  messages: Messages,
  callbacks: DialogCallbacks,
): DialogHandle {
  inputCounter = 0;

  let baseEnabled = false;
  let countdownSeconds: number | null = model.sendDelaySeconds > 0 ? model.sendDelaySeconds : null;

  const sendBtn = el("button", {
    className: "so-button so-button-primary",
    type: "button",
    text: messages.dialog.sendNow,
  });
  const backBtn = el("button", {
    className: "so-button so-button-secondary",
    type: "button",
    text: messages.dialog.backToEdit,
  });

  const updateButton = (): void => {
    const counting = countdownSeconds !== null && countdownSeconds > 0;
    sendBtn.disabled = !baseEnabled || counting;
    sendBtn.textContent = counting
      ? messages.dialog.sendInSeconds(countdownSeconds ?? 0)
      : messages.dialog.sendNow;
  };

  sendBtn.addEventListener("click", () => {
    callbacks.onSend();
  });
  backBtn.addEventListener("click", () => {
    callbacks.onBack();
  });

  const header = el("header", { className: "so-header" }, [
    el("h1", { className: "so-title", text: messages.dialog.title }),
    el("p", { className: "so-intro", text: messages.dialog.intro }),
  ]);

  const body = el("div", { className: "so-body-content" });
  const warningsBanner = buildWarnings(model.warnings, messages);
  if (warningsBanner) {
    body.append(warningsBanner);
  }
  body.append(
    buildRecipientsSection(model, messages, callbacks),
    buildAttachmentsSection(model, messages, callbacks),
    buildSubjectSection(model, messages),
    buildBodySection(model, messages, callbacks),
  );

  const footer = el("footer", { className: "so-footer" }, [backBtn, sendBtn]);

  const element = el("div", { className: "so-dialog" }, [header, body, footer]);

  updateButton();

  return {
    element,
    setSendEnabled(enabled: boolean): void {
      baseEnabled = enabled;
      updateButton();
    },
    setCountdown(seconds: number | null): void {
      countdownSeconds = seconds;
      updateButton();
    },
  };
}
