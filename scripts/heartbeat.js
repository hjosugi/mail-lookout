const DEFAULT_HOST = "https://avishaikofun.com"
const TIMEOUT_MS = 10_000
const RETRY_DELAY_MS = 20_000

const requiredPaths = [
  "/",
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

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
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
