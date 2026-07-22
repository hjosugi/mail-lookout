import type { Messages } from "../i18n/types"

const PRIVACY_URL = "/privacy.html"
const TERMS_URL = "/terms.html"

function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

function externalLink(href: string, text: string): HTMLAnchorElement {
  const link = textElement("a", "so-first-run-link", text)
  link.href = href
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  return link
}

/** Build the one-time onboarding and event-based activation disclosure. */
export function buildFirstRunView(messages: Messages, onContinue: () => void): HTMLElement {
  const copy = messages.firstRun
  const mark = document.createElement("img")
  mark.className = "so-first-run-mark"
  mark.src = "/assets/icon-80.png"
  mark.alt = ""
  mark.width = 64
  mark.height = 64

  const features = document.createElement("ul")
  features.className = "so-first-run-features"
  for (const feature of [copy.recipientFeature, copy.contentFeature, copy.delayFeature]) {
    features.append(textElement("li", "so-first-run-feature", feature))
  }

  const disclosure = document.createElement("section")
  disclosure.className = "so-first-run-disclosure"
  disclosure.append(
    textElement("h2", "so-first-run-section-title", copy.activationTitle),
    textElement("p", "so-first-run-copy", copy.activationBody),
    textElement("p", "so-first-run-limit", copy.activationLimit),
  )

  const links = document.createElement("nav")
  links.className = "so-first-run-links"
  links.setAttribute("aria-label", copy.legalLinksLabel)
  links.append(
    externalLink(PRIVACY_URL, copy.privacyPolicy),
    externalLink(TERMS_URL, copy.termsOfUse),
  )

  const button = textElement(
    "button",
    "so-button so-button-primary so-first-run-button",
    copy.start,
  )
  button.type = "button"
  button.addEventListener("click", onContinue)

  const view = document.createElement("main")
  view.className = "so-first-run"
  view.append(
    mark,
    textElement("h1", "so-first-run-title", copy.title),
    textElement("p", "so-first-run-value", copy.valueProposition),
    features,
    disclosure,
    textElement("p", "so-first-run-privacy", copy.privacySummary),
    links,
    button,
  )
  return view
}
