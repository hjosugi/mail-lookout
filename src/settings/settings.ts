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
import { getMessages, resolveLocale } from "../i18n/catalog"
import type { LocaleTag } from "../i18n"

/** Domains may be entered one per line or separated by commas/semicolons. */
const DOMAIN_SEPARATORS = /[\n,;]+/

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
  const messages = getMessages(locale).settings

  const domains = el("textarea", "so-set-input")
  domains.rows = 6
  domains.spellcheck = false
  const delay = el("input", "so-set-input so-set-delay")
  delay.type = "number"
  delay.min = "0"
  delay.max = "60"
  delay.step = "1"
  const status = el("p", "so-set-status")
  status.setAttribute("role", "status")

  const fill = (): void => {
    const current = currentSettings()
    domains.value = current.internalDomains.join("\n")
    delay.value = String(Math.round(current.sendDelaySeconds / 60))
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
    const minutes = Number(delay.value)
    const sendDelaySeconds = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) * 60 : 0
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

  const form = el("div", "so-settings")
  form.append(
    el("h1", "so-set-title", messages.title),
    el("p", "so-set-intro", messages.intro),
    field(messages.domainsLabel, domains, messages.domainsHint),
    field(`${messages.delayLabel}（${messages.delayUnit}）`, delay, messages.delayHint),
    actions,
    status,
  )

  root.classList.remove("loading")
  root.replaceChildren(form)
}

void Office.onReady(() => {
  const root = document.getElementById("root")
  if (!root) {
    return
  }
  const locale = resolveLocale(Office.context.displayLanguage, defaultConfig.fallbackLocale)
  start(locale, root)
})
