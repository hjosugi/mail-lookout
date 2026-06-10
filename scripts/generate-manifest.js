import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

function resolveDeployUrl() {
  return (
    process.env.ADDIN_HOST_URL ??
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL ??
    process.env.DEPLOY_URL ??
    "https://localhost:3000"
  )
}

function generateManifest() {
  const manifestPath = path.join(rootDir, "manifest.xml")
  const distDir = path.join(rootDir, "dist")
  const outputPath = path.join(distDir, "manifest.xml")

  if (!fs.existsSync(manifestPath)) {
    console.error("Error: manifest.xml not found at root")
    process.exit(1)
  }

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }

  let content = fs.readFileSync(manifestPath, "utf8")

  const deployUrl = resolveDeployUrl()
  const sanitizedUrl = deployUrl.replace(/\/$/, "")

  console.log(`[manifest-gen] Replacing https://localhost:3000 with ${sanitizedUrl}`)
  content = content.replaceAll("https://localhost:3000", sanitizedUrl)

  const addinGuid = process.env.ADDIN_GUID
  if (addinGuid) {
    console.log(`[manifest-gen] Replacing GUID with ${addinGuid}`)
    content = content.replace(/<Id>[^<]+<\/Id>/g, `<Id>${addinGuid}</Id>`)
  }

  fs.writeFileSync(outputPath, content, "utf8")
  console.log("[manifest-gen] Successfully generated manifest at dist/manifest.xml")
}

generateManifest()
