/**
 * Messages between the task pane (parent) and the review dialog.
 *
 * The dialog runs in a separate window opened with displayDialogAsync.
 * The two sides only exchange JSON strings: the parent seeds the dialog
 * with the review model through the launch URL, and the dialog reports
 * the user's checkbox state and final decision back with messageParent.
 *
 * The strings cross a window boundary, so decoding never trusts them:
 * anything malformed decodes to null and the caller starts fresh.
 */

import { initialReviewState } from "../domain/review"
import type { ReviewModel, ReviewState } from "../domain/review"
import { supportedLocales } from "../i18n/catalog"
import type { LocaleTag } from "../i18n/catalog"

/** A ReviewState with its sets flattened to arrays, so it survives JSON. */
export interface SerializableState {
  readonly recipients: number[]
  readonly attachments: number[]
  readonly subject: boolean
  readonly body: boolean
}

/** What the parent sends to seed the dialog (through the launch URL). */
export interface DialogInit {
  readonly model: ReviewModel
  readonly locale: LocaleTag
  readonly state: SerializableState
}

/** What the dialog sends back to the parent. */
export type DialogToParent =
  | { readonly type: "state"; readonly state: SerializableState }
  | {
      readonly type: "decision"
      readonly confirm: boolean
      readonly delaySeconds: number
      readonly state: SerializableState
    }

export function toSerializable(state: ReviewState): SerializableState {
  return {
    recipients: [...state.confirmedRecipients],
    attachments: [...state.confirmedAttachments],
    subject: state.subjectConfirmed,
    body: state.bodyConfirmed,
  }
}

export function fromSerializable(state: SerializableState, model: ReviewModel): ReviewState {
  const base = initialReviewState(model)
  return {
    confirmedRecipients: new Set(asIndices(state.recipients)),
    confirmedAttachments: new Set(asIndices(state.attachments)),
    subjectConfirmed: state.subject === true || base.subjectConfirmed,
    bodyConfirmed: state.body === true || base.bodyConfirmed,
  }
}

/** Encode the init payload for the dialog's launch URL hash. */
export function encodeInit(init: DialogInit): string {
  return encodeURIComponent(JSON.stringify(init))
}

/** Read and validate the init payload from a dialog URL hash fragment. */
export function decodeInit(rawHash: string): DialogInit | null {
  // URLSearchParams already percent-decodes the value, so the encodeInit
  // (encodeURIComponent) is undone here without a second decode.
  const params = new URLSearchParams(rawHash.replace(/^#/, ""))
  const raw = params.get("init")
  if (!raw) {
    return null
  }
  const parsed = parseJson(raw)
  if (!isRecord(parsed)) {
    return null
  }
  const model = parsed.model
  const locale = parsed.locale
  if (!isReviewModel(model) || !isLocale(locale)) {
    return null
  }
  return { model, locale, state: asSerializable(parsed.state) }
}

export function encodeMessage(message: DialogToParent): string {
  return JSON.stringify(message)
}

export function decodeMessage(raw: string): DialogToParent | null {
  const parsed = parseJson(raw)
  if (!isRecord(parsed)) {
    return null
  }
  if (parsed.type === "state") {
    return { type: "state", state: asSerializable(parsed.state) }
  }
  if (parsed.type === "decision") {
    return {
      type: "decision",
      confirm: parsed.confirm === true,
      delaySeconds: asNonNegative(parsed.delaySeconds),
      state: asSerializable(parsed.state),
    }
  }
  return null
}

// --- validation helpers --------------------------------------------------

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isLocale(value: unknown): value is LocaleTag {
  return typeof value === "string" && (supportedLocales as readonly string[]).includes(value)
}

/** A light structural check: enough to render without trusting the source. */
function isReviewModel(value: unknown): value is ReviewModel {
  return (
    isRecord(value) &&
    Array.isArray(value.recipients) &&
    Array.isArray(value.attachments) &&
    Array.isArray(value.warnings) &&
    typeof value.subject === "string" &&
    typeof value.bodyPreview === "string"
  )
}

function asSerializable(value: unknown): SerializableState {
  if (!isRecord(value)) {
    return { recipients: [], attachments: [], subject: false, body: false }
  }
  return {
    recipients: asIndices(value.recipients),
    attachments: asIndices(value.attachments),
    subject: value.subject === true,
    body: value.body === true,
  }
}

function asIndices(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 0,
  )
}

function asNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}
