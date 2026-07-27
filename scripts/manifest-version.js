/**
 * Print the <Version> of a manifest, so a release can tell the heartbeat
 * which version the host is expected to be serving.
 *
 * Usage: bun scripts/manifest-version.js [path-to-manifest]
 */

import fs from "node:fs"

const manifestPath = process.argv[2] ?? "manifest.xml"

if (!fs.existsSync(manifestPath)) {
  console.error(`[manifest-version] ${manifestPath} not found`)
  process.exit(1)
}

const version = /<Version>([^<]+)<\/Version>/.exec(fs.readFileSync(manifestPath, "utf8"))?.[1]

if (!version) {
  console.error(`[manifest-version] ${manifestPath} has no <Version>`)
  process.exit(1)
}

// Bare stdout: the caller substitutes this straight into a command line.
process.stdout.write(version)
