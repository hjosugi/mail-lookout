/// <reference types="office-js" />

/**
 * The Settings task pane.
 *
 * Lets the user edit the two per-device settings — the internal domains
 * and the default send-delay — and saves them to local storage, where
 * the send handler and review pane read them.
 */

import "../dialog/dialog.css"

import { defaultConfig } from "../config"
import { currentSettings, saveSettings, clearSettings } from "../office/userSettings"
import { listWaiting } from "../office/reviewProgress"
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag, Messages } from "../i18n"
import { delayMinutesToSeconds, secondsToDelayMinutes } from "../config/delayMinutes"

/** Domains may be entered one per line or separated by commas/semicolons. */
const DOMAIN_SEPARATORS = /[\n,;]+/

/** Format a remaining duration as "M:SS" once past a minute, else "Ns". */
function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`
}

/** Build the live "waiting to send" list, or an empty-state line. */
function buildWaitingSection(messages: Messages): { element: HTMLElement; refresh: () => void } {
  const section = el("div", "so-set-waiting")
  const refresh = (): void => {
    const items = listWaiting()
    const heading = el("p", "so-waiting-title", messages.waiting.settingsTitle)
    if (items.length === 0) {
      section.replaceChildren(heading, el("p", "so-set-hint", messages.waiting.empty))
      return
    }
    const list = el("ul", "so-waiting-list")
    for (const item of items) {
      const row = el("li", "so-waiting-item")
      row.append(
        el("span", "so-waiting-subject", item.subject.trim() || messages.subject.empty),
        el(
          "span",
          "so-waiting-meta",
          `${messages.waiting.recipients(item.recipientCount)} · ${messages.waiting.remaining(
            formatRemaining(Math.max(0, Math.ceil((item.deadline - Date.now()) / 1000))),
          )}`,
        ),
      )
      list.append(row)
    }
    section.replaceChildren(heading, list)
  }
  refresh()
  return { element: section, refresh }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) {
    node.className = className
  }
  if (text !== undefined) {
    node.textContent = text
  }
  return node
}

function field(labelText: string, input: HTMLElement, hintText: string): HTMLElement {
  const wrap = el("label", "so-set-field")
  wrap.append(el("span", "so-set-label", labelText), input, el("span", "so-set-hint", hintText))
  return wrap
}

function start(locale: LocaleTag, root: HTMLElement): void {
  const all = getMessages(locale)
  const messages = all.settings

  const domains = el("textarea", "so-set-input")
  domains.rows = 6
  domains.spellcheck = false
  const delay = el("input", "so-set-input so-set-delay")
  delay.type = "number"
  delay.min = "0"
  delay.max = "60"
  delay.step = "0.1"
  const status = el("p", "so-set-status")
  status.setAttribute("role", "status")

  const fill = (): void => {
    const current = currentSettings()
    domains.value = current.internalDomains.join("\n")
    delay.value = secondsToDelayMinutes(current.sendDelaySeconds)
  }
  fill()

  const setStatus = (text: string, ok: boolean): void => {
    status.textContent = text
    status.classList.toggle("so-set-error", !ok)
  }

  const save = el("button", "so-button so-button-primary", messages.save)
  save.type = "button"
  save.addEventListener("click", () => {
    const list = domains.value
      .split(DOMAIN_SEPARATORS)
      .map(item => item.trim())
      .filter(Boolean)
    const sendDelaySeconds = delayMinutesToSeconds(delay.value)
    if (list.length === 0) {
      setStatus(messages.invalid, false)
      return
    }
    saveSettings({ internalDomains: list, sendDelaySeconds }, ok => {
      if (ok) {
        fill()
        setStatus(messages.saved, true)
      } else {
        setStatus(messages.invalid, false)
      }
    })
  })

  const reset = el("button", "so-button so-button-secondary", messages.reset)
  reset.type = "button"
  reset.addEventListener("click", () => {
    clearSettings(() => {
      fill()
      setStatus("", true)
    })
  })

  const actions = el("div", "so-set-actions")
  actions.append(save, reset)

  const waiting = buildWaitingSection(all)

  const form = el("div", "so-settings")
  form.append(
    el("h1", "so-set-title", messages.title),
    el("p", "so-set-intro", messages.intro),
    field(messages.domainsLabel, domains, messages.domainsHint),
    field(`${messages.delayLabel}（${messages.delayUnit}）`, delay, messages.delayHint),
    actions,
    status,
    waiting.element,
  )

  root.classList.remove("loading")
  root.replaceChildren(form)
  window.setInterval(waiting.refresh, 1000)
}

void Office.onReady(() => {
  const root = document.getElementById("root")
  if (!root) {
    return
  }
  const locale = resolveLocale(Office.context.displayLanguage, defaultConfig.fallbackLocale)
  start(locale, root)
})
