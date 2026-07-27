/**
 * Run Microsoft's manifest validator and decide whether the result should
 * stop a release.
 *
 * The validator is a network service, so a non-zero exit means one of two
 * very different things: the manifest is genuinely invalid, or the service
 * could not be reached. Releases should stop for the first and not for the
 * second, and the CLI does not separate them for us — it reports both as
 * exit 1. The service-unreachable case is the one that prints "Unable to
 * validate the manifest", so that string is what we key on.
 *
 * Usage: bun scripts/validate-manifest.js [path-to-manifest]
 */

import { spawnSync } from "node:child_process"

const UNREACHABLE_MARKER = "Unable to validate the manifest"
const ATTEMPTS = 3
const RETRY_DELAY_MS = 5_000

function runValidator(manifestPath) {
  const result = spawnSync("bunx", ["office-addin-manifest", "validate", manifestPath], {
    encoding: "utf8",
  })

  if (result.error) {
    // The CLI itself could not be started, which is a local problem worth
    // failing on rather than excusing as validator downtime.
    return { ok: false, unreachable: false, output: result.error.message }
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  return {
    ok: result.status === 0,
    unreachable: result.status !== 0 && output.includes(UNREACHABLE_MARKER),
    output,
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const manifestPath = process.argv[2] ?? "manifest.xml"
  console.log(`[validate] checking ${manifestPath}`)

  let result
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    result = runValidator(manifestPath)

    if (!result.unreachable) {
      break
    }

    if (attempt < ATTEMPTS) {
      console.warn(`[validate] validator unreachable, retrying (${attempt}/${ATTEMPTS})`)
      await sleep(RETRY_DELAY_MS)
    }
  }

  process.stdout.write(result.output)

  if (result.ok) {
    console.log("[validate] manifest is valid")
    return
  }

  if (result.unreachable) {
    // Microsoft's uptime is not a release gate. The offline checks in
    // test/manifest.test.ts still ran, so this is a warning, not a stop.
    console.warn(
      "[validate] could not reach the validation service; skipping this check. " +
        "Re-run `bun run validate` once it is reachable.",
    )
    return
  }

  throw new Error("the manifest is not valid")
}

main().catch(error => {
  console.error(`[validate] ${error.message}`)
  process.exit(1)
})
