// maplibre-gl computes its Web Worker script URL from `import.meta.url` at
// runtime, guarded by `/^https?:/.test(...)`. Under Next.js's webpack/
// Turbopack bundling that value doesn't resolve to a real http(s) URL, so
// the guard fails and maplibre silently tries to spawn a worker with an
// empty URL (it never loads, so the map never renders any vector layers).
// Shipping our own static copy of the worker file and pointing
// maplibregl.setWorkerUrl() at it (see src/lib/map.ts) sidesteps the
// broken auto-detection entirely. Re-run on every `npm install` (see the
// "postinstall" script) so it stays in sync with the installed version.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// maplibre-gl-worker.mjs imports from ./maplibre-gl-shared.mjs (a sibling
// chunk), so both need to be copied together for the worker module to load.
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

for (const file of files) {
  const src = path.join(root, "node_modules/maplibre-gl/dist", file);
  const dest = path.join(root, "public", file);
  if (!existsSync(src)) {
    console.warn(`[copy-maplibre-worker] ${src} not found, skipping`);
    continue;
  }
  copyFileSync(src, dest);
  console.log(`[copy-maplibre-worker] copied to public/${file}`);
}
