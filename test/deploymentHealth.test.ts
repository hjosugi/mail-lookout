import { afterEach, describe, expect, it, vi } from "vitest"

import { checkCompanySite, checkRootRedirect, checkUrl } from "../scripts/deployment-health"

const HOST = "https://addin.example"
const COMPANY = "https://www.avishaikofun.com/"

function response(url: string, body: string, status = 200, headers = {}) {
  return Object.defineProperty(new Response(body, { status, headers }), "url", { value: url })
}

afterEach(() => vi.unstubAllGlobals())

describe("deployed add-in resources", () => {
  it("accepts Pages' same-host HTML redirects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(`${HOST}/taskpane`, "<html></html>")))
    await expect(checkUrl(HOST, "/taskpane.html")).resolves.toMatchObject({ status: 200 })
  })

  it("rejects runtime pages redirected to the company site", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(COMPANY, "<html></html>")))
    await expect(checkUrl(HOST, "/commands.html")).rejects.toThrow("redirected off-host")
  })

  it("rejects a missing settings page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(`${HOST}/settings`, "missing", 404)))
    await expect(checkUrl(HOST, "/settings.html")).rejects.toThrow("returned 404")
  })

  it("rejects an HTML fallback returned as 200 for the send handler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(`${HOST}/assets/commands.js`, "<html></html>", 200, {
          "content-type": "text/html",
        }),
      ),
    )
    await expect(checkUrl(HOST, "/assets/commands.js")).rejects.toThrow(
      "does not look like JavaScript",
    )
  })

  it.each(["text/javascript; charset=utf-8", "application/javascript"])(
    "accepts a JavaScript bundle with %s",
    async contentType => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          response(`${HOST}/assets/commands.js`, "Office.onReady(() => {});", 200, {
            "content-type": contentType,
          }),
        ),
      )
      await expect(checkUrl(HOST, "/assets/commands.js")).resolves.toMatchObject({ status: 200 })
    },
  )

  it("rejects a stale manifest after a successful upload", async () => {
    const xml = `<OfficeApp><Version>1.1.15.0</Version><SupportUrl DefaultValue="${HOST}/support.html" /></OfficeApp>`
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(`${HOST}/manifest.xml`, xml)))
    await expect(checkUrl(HOST, "/manifest.xml", "1.1.16.0")).rejects.toThrow(
      "serves version 1.1.15.0, expected 1.1.16.0",
    )
  })

  it("rejects a non-manifest body even if served with an XML content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(`${HOST}/manifest.xml`, "<Error />", 200, { "content-type": "application/xml" }),
        ),
    )
    await expect(checkUrl(HOST, "/manifest.xml")).rejects.toThrow(
      "does not look like an Office manifest",
    )
  })
})

describe("company site redirect", () => {
  it("accepts the root redirect only when its destination serves HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(`${HOST}/`, "", 308, { location: COMPANY }))
        .mockResolvedValueOnce(response(COMPANY, "<!doctype html><html></html>")),
    )
    await expect(checkRootRedirect(HOST)).resolves.toMatchObject({ path: "/", status: 308 })
  })

  it.each([404, 500, 503])("rejects a redirect to a destination returning %s", async status => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(`${HOST}/`, "", 308, { location: COMPANY }))
        .mockResolvedValueOnce(response(COMPANY, "error", status)),
    )
    await expect(checkRootRedirect(HOST)).rejects.toThrow(`returned ${status}, expected 200`)
  })

  it("rejects a self-redirect when www belongs to the add-in project", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(COMPANY, "", 308, { location: "/" })))
    await expect(checkCompanySite()).rejects.toThrow("redirects to itself")
  })

  it("names the unreachable redirect destination", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
    await expect(checkCompanySite()).rejects.toThrow(`${COMPANY} is not reachable`)
  })

  it("rejects an unexpected root redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(`${HOST}/`, "", 308, { location: "https://elsewhere.example/" }),
        ),
    )
    await expect(checkRootRedirect(HOST)).rejects.toThrow("redirects to https://elsewhere.example/")
  })

  it("rejects an old root page that was not replaced by the redirect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(`${HOST}/`, "<html></html>")))
    await expect(checkRootRedirect(HOST)).rejects.toThrow("returned 200, expected a redirect")
  })
})
