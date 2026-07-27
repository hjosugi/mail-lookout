/// <reference types="node" />

/**
 * Manifest lint.
 *
 * The manifest is the only part of the add-in that Outlook reads before
 * anything of ours runs, so a defect here surfaces as a bare "something
 * went wrong" at install time with no stack to work from. Microsoft's
 * validator is the real authority, but it is a network service; these
 * checks cover the structural mistakes that are cheap to catch offline
 * and keep the hand-edited manifest from drifting out of agreement with
 * itself, with package.json, and with the files we actually deploy.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const manifest = fs.readFileSync(path.join(rootDir, "manifest.xml"), "utf8")
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
  version: string
}

/** The host generate-manifest.js swaps for the deploy URL. */
const PLACEHOLDER_HOST = "https://localhost:3000"

/** Which FormSettings form each activation FormType needs to exist. */
const REQUIRED_FORMS: Record<string, readonly string[]> = {
  Read: ["ItemRead"],
  Edit: ["ItemEdit"],
  ReadOrEdit: ["ItemRead", "ItemEdit"],
}

function matchAll(pattern: RegExp): string[] {
  return [...manifest.matchAll(pattern)].map(match => match[1] ?? "")
}

describe("manifest activation rules", () => {
  it("declares a FormSettings form for every FormType it activates on", () => {
    const declaredForms = matchAll(/<Form\s+xsi:type="([^"]+)"/g)
    const formTypes = matchAll(/<Rule[^>]*\bFormType="([^"]+)"/g)

    expect(formTypes.length).toBeGreaterThan(0)

    for (const formType of formTypes) {
      expect(REQUIRED_FORMS[formType], `unknown FormType "${formType}"`).toBeDefined()
      for (const form of REQUIRED_FORMS[formType] ?? []) {
        expect(declaredForms, `FormType "${formType}" needs a ${form} form`).toContain(form)
      }
    }
  })
})

describe("manifest requirement sets", () => {
  it("gates install and runtime on the same Mailbox version", () => {
    // The base <Requirements> decides who can install; the one inside
    // VersionOverrides decides who gets the modern surfaces. If they
    // drift, the add-in either installs somewhere it cannot work or is
    // blocked from clients that could run it.
    const versions = new Set(matchAll(/Name="Mailbox"[^>]*MinVersion="([^"]+)"/g))
    const defaults = new Set(matchAll(/<bt:Sets\s+DefaultMinVersion="([^"]+)"/g))

    expect(versions.size, `Mailbox MinVersion values differ: ${[...versions].join(", ")}`).toBe(1)
    for (const fallback of defaults) {
      expect(versions).toContain(fallback)
    }
  })

  it("still requires the version item.sendAsync needs", () => {
    // The countdown sends the message itself with MessageCompose.sendAsync,
    // which is Mailbox 1.15. Lowering the requirement to widen install
    // reach would break the send path instead.
    expect(manifest).toContain('Name="Mailbox" MinVersion="1.15"')
  })
})

describe("manifest resources", () => {
  it("resolves every resid against a declared resource", () => {
    const referenced = new Set(matchAll(/\bresid="([^"]+)"/g))
    const declared = new Set(matchAll(/<bt:(?:Image|Url|String)\s+id="([^"]+)"/g))

    for (const resid of referenced) {
      expect(declared, `resid "${resid}" is not declared in Resources`).toContain(resid)
    }
  })

  it("has no unreferenced resource", () => {
    const referenced = new Set(matchAll(/\bresid="([^"]+)"/g))
    const declared = matchAll(/<bt:(?:Image|Url|String)\s+id="([^"]+)"/g)

    for (const id of declared) {
      expect(referenced, `resource "${id}" is declared but never used`).toContain(id)
    }
  })
})

describe("manifest URLs", () => {
  const urls = matchAll(/(?:DefaultValue|Value)="(https?:\/\/[^"]+)"/g).concat(
    matchAll(/<AppDomain>(https?:\/\/[^<]+)<\/AppDomain>/g),
  )

  it("points every URL at the placeholder host", () => {
    // generate-manifest.js rewrites this one host to the deploy URL.
    // Anything else ships pointing at a developer's machine.
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url.startsWith(`${PLACEHOLDER_HOST}/`) || url === PLACEHOLDER_HOST).toBe(true)
    }
  })

  it("serves every page and icon it references", () => {
    for (const url of urls) {
      const pathname = url.slice(PLACEHOLDER_HOST.length)
      if (pathname === "" || pathname === "/") {
        continue
      }

      if (pathname.endsWith(".html")) {
        expect(fs.existsSync(path.join(rootDir, pathname.slice(1))), `${pathname} is missing`).toBe(
          true,
        )
      } else if (pathname.endsWith(".js")) {
        // Vite emits entries as assets/<name>.js from <name>.html, so the
        // page is what has to exist for the bundle to be built.
        const entry = path.basename(pathname, ".js")
        expect(fs.existsSync(path.join(rootDir, `${entry}.html`)), `${pathname} has no entry`).toBe(
          true,
        )
      } else {
        expect(
          fs.existsSync(path.join(rootDir, "public", pathname.slice(1))),
          `${pathname} is missing`,
        ).toBe(true)
      }
    }
  })
})

describe("manifest version", () => {
  it("matches package.json", () => {
    const version = /<Version>([^<]+)<\/Version>/.exec(manifest)?.[1]

    expect(version).toBe(`${packageJson.version}.0`)
  })
})
