/**
 * D-Vault extension build.
 *
 * Uses esbuild with three single-entry IIFE bundles (content scripts cannot
 * be ES modules in MV3) plus the popup and static assets. The output in
 * dist/ is a complete unpacked extension.
 */
import { build } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(root, "..");
const dist = path.join(extDir, "dist");
const publicDir = path.join(extDir, "public");
const coreDir = path.resolve(extDir, "../../packages/core/src");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "icons"), { recursive: true });

/** Shared esbuild settings: bundle @dvault/core from TypeScript source. */
const common = {
  bundle: true,
  format: "iife",
  target: ["chrome120"],
  sourcemap: false,
  minify: true,
  legalComments: "none",
  loader: { ".ts": "ts", ".tsx": "tsx" },
  alias: { "@dvault/core": path.join(coreDir, "index.ts") },
  define: { "process.env.NODE_ENV": '"production"' },
};

await Promise.all([
  build({
    ...common,
    entryPoints: [path.join(extDir, "src/content.tsx")],
    outfile: path.join(dist, "content.js"),
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  }),
  build({
    ...common,
    entryPoints: [path.join(extDir, "src/background.ts")],
    outfile: path.join(dist, "background.js"),
  }),
  build({
    ...common,
    entryPoints: [path.join(extDir, "src/popup.ts")],
    outfile: path.join(dist, "popup.js"),
  }),
]);

// static assets
fs.cpSync(publicDir, dist, { recursive: true });

// verify icon presence
for (const size of [16, 32, 48, 128]) {
  const icon = path.join(dist, "icons", `icon${size}.png`);
  if (!fs.existsSync(icon)) {
    console.warn(`⚠ ${icon} missing — run "npm run icons" in apps/extension first.`);
  }
}

console.log("✓ D-Vault extension built →", dist);
