import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

const args = process.argv.slice(2)
const flags = new Set(args.filter(arg => arg.startsWith("--")))
const target = args.find(arg => !arg.startsWith("--")) ?? "patch"

const knownFlags = new Set(["--dry-run"])
for (const flag of flags) {
  if (!knownFlags.has(flag)) {
    fail(`Unknown flag: ${flag}`)
  }
}

const dryRun = flags.has("--dry-run")

const packageJsonPath = path.join(rootDir, "package.json")
const manifestPath = path.join(rootDir, "manifest.xml")

const packageJson = readJson(packageJsonPath)
const currentVersion = parseStableVersion(packageJson.version)
const nextVersion = resolveNextVersion(currentVersion, target)
const nextPackageVersion = formatPackageVersion(nextVersion)
const nextManifestVersion = `${nextPackageVersion}.0`

packageJson.version = nextPackageVersion

let manifest = fs.readFileSync(manifestPath, "utf8")
const manifestVersionMatch = /<Version>([^<]+)<\/Version>/.exec(manifest)
if (!manifestVersionMatch) {
  fail("manifest.xml does not contain a <Version> element.")
}
const currentManifestVersion = manifestVersionMatch[1]
manifest = manifest.replace(
  /<Version>[^<]+<\/Version>/,
  `<Version>${nextManifestVersion}</Version>`,
)

if (dryRun) {
  console.log(
    `[bump-version] package.json: ${formatPackageVersion(currentVersion)} -> ${nextPackageVersion}`,
  )
  console.log(`[bump-version] manifest.xml: ${currentManifestVersion} -> ${nextManifestVersion}`)
  console.log("[bump-version] Dry run only. No files were changed.")
  process.exit(0)
}

writeJson(packageJsonPath, packageJson)
fs.writeFileSync(manifestPath, manifest, "utf8")

console.log(
  `[bump-version] package.json: ${formatPackageVersion(currentVersion)} -> ${nextPackageVersion}`,
)
console.log(`[bump-version] manifest.xml: ${currentManifestVersion} -> ${nextManifestVersion}`)

// Automatically stage and commit the changes
const gitAdd = spawnSync("git", ["add", "-A"], { cwd: rootDir, stdio: "inherit" })
if (gitAdd.status !== 0) {
  fail("git add -A failed.")
}

const commitMsg = `chore: bump version to ${nextPackageVersion}`
const gitCommit = spawnSync("git", ["commit", "-m", commitMsg], { cwd: rootDir, stdio: "inherit" })
if (gitCommit.status !== 0) {
  fail(`git commit failed: ${gitCommit.error || `status code ${gitCommit.status}`}`)
}
console.log(`[bump-version] Successfully committed: "${commitMsg}"`)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8")
}

function parseStableVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value)
  if (!match) {
    fail(`Unsupported package version: ${value}. Expected a stable x.y.z version.`)
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function resolveNextVersion(version, requested) {
  if (/^\d+\.\d+\.\d+$/.test(requested)) {
    return parseStableVersion(requested)
  }

  switch (requested) {
    case "patch":
      return { ...version, patch: version.patch + 1 }
    case "minor":
      return { major: version.major, minor: version.minor + 1, patch: 0 }
    case "major":
      return { major: version.major + 1, minor: 0, patch: 0 }
    default:
      fail(`Unknown version target: ${requested}. Use patch, minor, major, or x.y.z.`)
  }
}

function formatPackageVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`
}

function fail(message) {
  console.error(`[bump-version] ${message}`)
  process.exit(1)
}
