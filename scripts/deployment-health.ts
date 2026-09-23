const TIMEOUT_MS = 10_000

export const COMPANY_SITE_URL = "https://www.avishaikofun.com/"

export const requiredPaths = [
  "/manifest.xml",
  "/commands.html",
  "/taskpane.html",
  "/settings.html",
  "/assets/commands.js",
  "/assets/taskpane.js",
  "/assets/settings.js",
  "/support.html",
  "/privacy.html",
  "/terms.html",
  "/favicon.ico",
  "/assets/icon-16.png",
  "/assets/icon-32.png",
  "/assets/icon-64.png",
  "/assets/icon-80.png",
  "/assets/icon-96.png",
  "/assets/icon-128.png",
]

// Keep the timeout active while consuming the body too. A server can send
// headers successfully and then stall indefinitely while streaming the file.
async function fetchResource(url: string, redirect: RequestRedirect = "follow") {
  const response = await fetch(url, { redirect, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const body = await response.text()
  return { response, body }
}

export async function checkUrl(host: string, path: string, expectedVersion?: string) {
  const url = `${host}${path}`
  const { response, body } = await fetchResource(url)
  const contentType = response.headers.get("content-type") ?? ""

  if (response.status !== 200) {
    throw new Error(`${url} returned ${response.status}, expected 200`)
  }

  // Pages redirects /foo.html to /foo. Same-origin redirects are fine;
  // sending an Outlook runtime URL to the company site is not.
  if (new URL(response.url).origin !== new URL(url).origin) {
    throw new Error(`${url} redirected off-host to ${response.url}`)
  }

  if (path.endsWith(".html") && !contentType.includes("text/html") && !body.includes("<html")) {
    throw new Error(`${url} does not look like HTML`)
  }

  if (path.endsWith(".js") && !/^(?:text|application)\/(?:java|ecma)script\b/i.test(contentType)) {
    throw new Error(`${url} does not look like JavaScript`)
  }

  if (path === "/manifest.xml") {
    if (!body.includes("<OfficeApp")) {
      throw new Error(`${url} does not look like an Office manifest`)
    }
    if (body.includes("localhost") || body.includes("127.0.0.1")) {
      throw new Error(`${url} still contains a local development URL`)
    }
    if (!body.includes(`${host}/support.html`)) {
      throw new Error(`${url} does not point SupportUrl at ${host}/support.html`)
    }
    if (expectedVersion) {
      const served = /<Version>([^<]+)<\/Version>/.exec(body)?.[1]
      if (served !== expectedVersion) {
        throw new Error(`${url} serves version ${served ?? "none"}, expected ${expectedVersion}`)
      }
    }
  }

  return { path, status: response.status, contentType: contentType.split(";")[0] }
}

/** Used before deploying the redirect and when checking the deployed root. */
export async function checkCompanySite() {
  let resource
  try {
    resource = await fetchResource(COMPANY_SITE_URL, "manual")
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${COMPANY_SITE_URL} is not reachable (${detail}). ` +
        "Attach that hostname to the company site's Pages project before deploying this redirect.",
    )
  }

  const { response, body } = resource
  const next = response.headers.get("location")
  if (
    response.status >= 300 &&
    response.status < 400 &&
    next &&
    new URL(next, COMPANY_SITE_URL).href === COMPANY_SITE_URL
  ) {
    throw new Error(
      `${COMPANY_SITE_URL} redirects to itself — www is probably still a custom domain on this Pages project`,
    )
  }
  if (response.status !== 200) {
    throw new Error(`${COMPANY_SITE_URL} returned ${response.status}, expected 200`)
  }
  if (!body.toLowerCase().includes("<html")) {
    throw new Error(`${COMPANY_SITE_URL} does not look like HTML`)
  }
}

export async function checkRootRedirect(host: string) {
  const url = `${host}/`
  const { response } = await fetchResource(url, "manual")
  if (response.status < 300 || response.status > 399) {
    throw new Error(
      `${url} returned ${response.status}, expected a redirect to ${COMPANY_SITE_URL}`,
    )
  }

  const location = response.headers.get("location")
  if (!location) {
    throw new Error(`${url} returned ${response.status} with no Location header`)
  }
  const target = new URL(location, url).href
  if (target !== COMPANY_SITE_URL) {
    throw new Error(`${url} redirects to ${target}, expected ${COMPANY_SITE_URL}`)
  }

  await checkCompanySite()
  return { path: "/", status: response.status, contentType: `-> ${target}` }
}
