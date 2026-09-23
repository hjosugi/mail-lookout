import { checkRootRedirect, checkUrl, requiredPaths } from "./deployment-health.ts"

const DEFAULT_HOST = "https://avishaikofun.com"
const RETRY_DELAY_MS = 20_000

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
