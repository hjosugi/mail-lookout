import { spawnSync } from "node:child_process"
import { checkCompanySite } from "./deployment-health.ts"

function run(args, capture = false) {
  const result = spawnSync("bun", args, {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  })
  if (result.error || result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr)
    throw new Error(result.error?.message ?? `bun ${args.join(" ")} failed (${result.status})`)
  }
  return result.stdout?.trim()
}

async function main() {
  // Publish the already-built artifact. Both CI and emergency local deploys
  // check the redirect target before writing and the live version afterwards.
  const version = run(["scripts/manifest-version.js", "dist/manifest.xml"], true)
  await checkCompanySite()
  run(["x", "wrangler", "pages", "deploy", "dist", "--project-name=avishai-kofun", "--branch=main"])
  run([
    "scripts/heartbeat.js",
    "--host=https://avishaikofun.com",
    "--attempts=10",
    `--expect-version=${version}`,
  ])
}

main().catch(error => {
  console.error(`[deploy] ${error.message}`)
  process.exit(1)
})
