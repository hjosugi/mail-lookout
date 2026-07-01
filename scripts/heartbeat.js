const DEFAULT_HOST = "https://avishaikofun.com"
const TIMEOUT_MS = 10_000

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
  "/assets/icon-128.png",
]

function parseHost() {
  const hostArg = process.argv.find(arg => arg.startsWith("--host="))
  const host = hostArg?.slice("--host=".length) ?? process.env.ADDIN_HOST_URL ?? DEFAULT_HOST
  return host.replace(/\/$/, "")
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

async function checkUrl(host, path) {
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
  }

  return {
    path,
    status: response.status,
    contentType: contentType.split(";")[0],
  }
}

async function main() {
  const host = parseHost()
  console.log(`[heartbeat] checking ${host}`)

  const results = []
  const failures = []
  for (const path of requiredPaths) {
    try {
      results.push(await checkUrl(host, path))
    } catch (error) {
      failures.push(error)
    }
  }

  for (const result of results) {
    console.log(`[ok] ${result.status} ${result.path} ${result.contentType}`)
  }

  for (const failure of failures) {
    console.error(`[fail] ${failure.message}`)
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} check(s) failed`)
  }

  console.log("[heartbeat] all checks passed")
}

main().catch(error => {
  console.error(`[heartbeat] ${error.message}`)
  process.exit(1)
})
