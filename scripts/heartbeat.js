const DEFAULT_HOST = "https://avishaikofun.com"
const TIMEOUT_MS = 10_000
const RETRY_DELAY_MS = 20_000

/** Where the apex root is expected to send visitors. */
const COMPANY_SITE_URL = "https://www.avishaikofun.com/"

// Paths this host must serve itself, with a 200. The root is not one of
// them: it is a redirect to the company site now, and gets its own check
// below. Nothing here reaches into that separate site, so the add-in's
// health never depends on a marketing page being up.
const requiredPaths = [
  "/manifest.xml",
  "/commands.html",
  "/taskpane.html",
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

function parseArg(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function parseHost() {
  const host = parseArg("host", process.env.ADDIN_HOST_URL ?? DEFAULT_HOST)
  return host.replace(/\/$/, "")
}

/**
 * The four-part manifest version the host is expected to be serving, or
 * undefined to accept whatever is deployed. A release passes this so it
 * cannot ship a manifest asset while the host still serves an older build.
 */
function parseExpectedVersion() {
  return parseArg("expect-version", process.env.ADDIN_EXPECT_VERSION) || undefined
}

/**
 * A deploy can still be in flight when a release runs, so the caller can
 * ask for a few attempts before treating the host as broken.
 */
function parseAttempts() {
  const attempts = Number(parseArg("attempts", "1"))
  return Number.isInteger(attempts) && attempts > 0 ? attempts : 1
}

async function fetchWithTimeout(url, redirect = "follow") {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    return await fetch(url, {
      method: "GET",
      redirect,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function checkUrl(host, path, expectedVersion) {
  const url = `${host}${path}`
  const response = await fetchWithTimeout(url)
  const contentType = response.headers.get("content-type") ?? ""
  const body = await response.text()

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`)
  }

  // Redirects are followed on purpose: Cloudflare Pages 308s /foo.html
  // to /foo, and the manifest still points at the .html form. What must
  // not slip through is a redirect that leaves this host. The manifest
  // hard-codes these URLs, so a rule sending them elsewhere would break
  // Outlook while every status code along the way still read as 200.
  if (new URL(response.url).origin !== new URL(url).origin) {
    throw new Error(`${url} redirected off-host to ${response.url}`)
  }

  if (path.endsWith(".html") || path === "/") {
    if (!contentType.includes("text/html") && !body.includes("<html")) {
      throw new Error(`${url} does not look like HTML`)
    }
  }

  if (path === "/manifest.xml") {
    if (!contentType.includes("xml") && !body.includes("<OfficeApp")) {
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

  return {
    path,
    status: response.status,
    contentType: contentType.split(";")[0],
  }
}

/**
 * The apex root must redirect to the company site, and that redirect
 * must land somewhere other than this host.
 *
 * Both halves catch a real failure. If `public/_redirects` fails to
 * deploy, the root 404s and the company site is unreachable from the
 * domain everyone types. If the rule instead resolves back to this
 * host — which is what happens while `www` is still a custom domain on
 * this Pages project — then every request to www matches the same rule
 * and redirects to itself forever. That loop is invisible from the apex
 * side, so the second fetch below checks the target directly.
 */
async function checkRootRedirect(host) {
  const url = `${host}/`
  const response = await fetchWithTimeout(url, "manual")

  if (response.status < 300 || response.status > 399) {
    throw new Error(
      `${url} returned ${response.status}, expected a redirect to ${COMPANY_SITE_URL}`,
    )
  }

  const location = response.headers.get("location")
  if (!location) {
    throw new Error(`${url} returned ${response.status} with no Location header`)
  }

  const target = new URL(location, url).toString()
  if (target !== COMPANY_SITE_URL) {
    throw new Error(`${url} redirects to ${target}, expected ${COMPANY_SITE_URL}`)
  }

  let hop
  try {
    hop = await fetchWithTimeout(target, "manual")
  } catch (error) {
    // Most likely the redirect target has no DNS record yet, which makes
    // the bare domain a dead end. Say so, rather than surfacing a bare
    // "fetch failed" against a URL the reader has to go look up.
    throw new Error(
      `${url} redirects to ${target}, which is not reachable (${error.message}). ` +
        `Attach that hostname to the company site's Pages project before deploying this redirect.`,
    )
  }

  const next = hop.headers.get("location")
  if (next && new URL(next, target).toString() === target) {
    throw new Error(
      `${target} redirects to itself — www is probably still a custom domain on this Pages project`,
    )
  }

  return { path: "/", status: response.status, contentType: `-> ${target}` }
}

async function sweep(host, expectedVersion) {
  const results = []
  const failures = []
  for (const path of requiredPaths) {
    try {
      results.push(await checkUrl(host, path, expectedVersion))
    } catch (error) {
      failures.push(error)
    }
  }

  try {
    results.push(await checkRootRedirect(host))
  } catch (error) {
    failures.push(error)
  }

  return { results, failures }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const host = parseHost()
  const expectedVersion = parseExpectedVersion()
  const attempts = parseAttempts()

  console.log(`[heartbeat] checking ${host}${expectedVersion ? ` for ${expectedVersion}` : ""}`)

  let sweepResult
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    sweepResult = await sweep(host, expectedVersion)

    if (sweepResult.failures.length === 0) {
      break
    }

    if (attempt < attempts) {
      console.warn(`[heartbeat] ${sweepResult.failures.length} check(s) failed, retrying`)
      await sleep(RETRY_DELAY_MS)
    }
  }

  for (const result of sweepResult.results) {
    console.log(`[ok] ${result.status} ${result.path} ${result.contentType}`)
  }

  for (const failure of sweepResult.failures) {
    console.error(`[fail] ${failure.message}`)
  }

  if (sweepResult.failures.length > 0) {
    throw new Error(`${sweepResult.failures.length} check(s) failed`)
  }

  console.log("[heartbeat] all checks passed")
}

main().catch(error => {
  console.error(`[heartbeat] ${error.message}`)
  process.exit(1)
})
