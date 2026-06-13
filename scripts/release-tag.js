import { spawnSync } from "node:child_process"
import { readFileSync, readSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

const args = process.argv.slice(2)
const flags = new Set(args.filter(arg => arg.startsWith("--")))
const tagArg = args.find(arg => !arg.startsWith("--"))

const knownFlags = new Set([
  "--dry-run",
  "--offline",
  "--allow-dirty",
  "--allow-branch",
  "--yes",
])
for (const flag of flags) {
  if (!knownFlags.has(flag)) {
    fail(`Unknown flag: ${flag}`)
  }
}

const dryRun = flags.has("--dry-run")
const offline = flags.has("--offline")
const allowDirty = flags.has("--allow-dirty")
const allowBranch = flags.has("--allow-branch")
const skipConfirm = flags.has("--yes")

const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"))
const tag = normalizeTag(tagArg ?? packageJson.version)

function normalizeTag(value) {
  const normalized = value.startsWith("v") ? value : `v${value}`
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(normalized)) {
    fail(`Invalid release tag: ${value}. Expected v1.2.3 or 1.2.3.`)
  }
  return normalized
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : "inherit",
  })

  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  return result
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
  console.error(`[release-tag] ${message}`)
  process.exit(1)
}

const branch = output("git", ["branch", "--show-current"])
if (!allowBranch && branch !== "main") {
  fail(`Release tags must be created from main. Current branch: ${branch}`)
}

const status = output("git", ["status", "--porcelain"])
if (!allowDirty && status) {
  fail("Working tree is not clean. Commit or stash changes before tagging.")
}

if (!offline) {
  run("git", ["fetch", "--tags", "origin", "main"])
}

const head = output("git", ["rev-parse", "HEAD"])
if (!offline) {
  const upstream = output("git", ["rev-parse", "origin/main"])
  if (head !== upstream) {
    fail("HEAD does not match origin/main. Push or pull before tagging.")
  }
}

const localTag = run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
  allowFailure: true,
  quiet: true,
})
if (localTag.status === 0) {
  fail(`Local tag already exists: ${tag}`)
}

if (!offline) {
  const remoteTag = run(
    "git",
    ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`],
    {
      allowFailure: true,
      quiet: true,
    },
  )
  if (remoteTag.status === 0) {
    fail(`Remote tag already exists: ${tag}`)
  }
  if (remoteTag.status !== 2) {
    process.stderr.write(remoteTag.stderr)
    process.exit(remoteTag.status ?? 1)
  }
}

console.log(`[release-tag] Release tag: ${tag}`)
console.log(`[release-tag] Commit: ${head}`)

if (dryRun) {
  console.log("[release-tag] Dry run only. No tag was created or pushed.")
  process.exit(0)
}

if (!skipConfirm && !confirm(`[release-tag] Create and push ${tag}? [y/N] `)) {
  console.log("[release-tag] Aborted. No tag was created or pushed.")
  process.exit(0)
}

run("git", ["tag", "-a", tag, "-m", `mail-lookout ${tag}`])
run("git", ["push", "origin", tag])

console.log(`[release-tag] Pushed ${tag}. GitHub Actions will create the release asset.`)

/** Ask a yes/no question on the terminal; true only on an explicit yes. */
function confirm(question) {
  process.stdout.write(question)
  const buffer = Buffer.alloc(256)
  let bytesRead
  try {
    bytesRead = readSync(0, buffer, 0, buffer.length, null)
  } catch {
    // No interactive terminal to read from: treat as "no".
    return false
  }
  const answer = buffer.toString("utf8", 0, bytesRead).trim().toLowerCase()
  return answer === "y" || answer === "yes"
}
