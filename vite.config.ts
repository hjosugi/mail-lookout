/**
 * Vite config.
 *
 * Build: static public pages plus the Office runtime entries at the
 * project root. Entry JS keeps a stable name so the manifest URLs do
 * not change between builds. Chunks and assets are hashed for caching.
 *
 * Dev server: HTTPS, which Outlook requires. The certificate comes
 * from office-addin-dev-certs. If it is not installed yet, we fall
 * back to HTTP and print a hint. Local browser testing can fall
 * back to another port when 3000 is busy; the Outlook script uses
 * --strictPort because the manifest points at localhost:3000.
 *
 * Test: Vitest runs in a node environment over test/. Coverage is
 * measured on the pure layers, where the logic lives.
 */

import { fileURLToPath } from "node:url"
import type { ServerOptions } from "vite"
import { defineConfig } from "vitest/config"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

/** Load HTTPS options from dev-certs, or undefined if missing. */
async function httpsOptions(): Promise<ServerOptions["https"]> {
  try {
    const devCerts = await import("office-addin-dev-certs")
    const options = await devCerts.getHttpsServerOptions()
    return { key: options.key, cert: options.cert, ca: options.ca }
  } catch {
    console.warn(
      "[mail-lookout] HTTPS certs not found. Run `npm run dev-certs`. Falling back to HTTP.",
    )
    return undefined
  }
}

const https = await httpsOptions()

export default defineConfig({
  root: rootDir,
  resolve: {
    // "@/..." resolves to src, matching the tsconfig paths alias.
    alias: { "@": fileURLToPath(new URL("src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("index.html", import.meta.url)),
        privacy: fileURLToPath(new URL("privacy.html", import.meta.url)),
        support: fileURLToPath(new URL("support.html", import.meta.url)),
        terms: fileURLToPath(new URL("terms.html", import.meta.url)),
        commands: fileURLToPath(new URL("commands.html", import.meta.url)),
        taskpane: fileURLToPath(new URL("taskpane.html", import.meta.url)),
        settings: fileURLToPath(new URL("settings.html", import.meta.url)),
        emulator: fileURLToPath(new URL("emulator.html", import.meta.url)),
      },
      output: {
        // Stable names for the JS entries keep manifest URLs fixed.
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    https,
  },
  preview: {
    port: 3000,
    strictPort: false,
    https,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/i18n/**", "src/shared/**", "src/config/**"],
    },
  },
})
