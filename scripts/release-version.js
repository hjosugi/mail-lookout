import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

const args = process.argv.slice(2)
const flags = new Set(args.filter(arg => arg.startsWith("--")))
const target = args.find(arg => !arg.startsWith("--")) ?? "patch"

const knownFlags = new Set(["--dry-run", "--offline", "--allow-branch"])
for (const flag of flags) {
  if (!knownFlags.has(flag)) {
    fail(`Unknown flag: ${flag}`)
  }
}

const dryRun = flags.has("--dry-run")
const releaseTagFlags = [...flags].filter(flag => flag !== "--dry-run")

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: "inherit",
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function output(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
  })

  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  return result.stdout.trim()
}

function fail(message) {
  console.error(`[release-version] ${message}`)
  process.exit(1)
}

run("node", ["scripts/bump-version.js", target, ...(dryRun ? ["--dry-run"] : [])])

if (dryRun) {
  console.log("[release-version] Dry run only. No branch or tag was pushed.")
  process.exit(0)
}

const branch = output("git", ["branch", "--show-current"])
run("git", ["push", "origin", branch])
run("node", ["scripts/release-tag.js", "--yes", ...releaseTagFlags])
