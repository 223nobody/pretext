import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { build } from "esbuild";

import { writeZipFromDirectory } from "./zip-utils.mjs";

const root = resolve(import.meta.dirname, "..");
const addonDir = resolve(root, "addon");
const buildDir = resolve(root, "build");
const readerJs = resolve(addonDir, "content", "reader.js");
const xpiPath = resolve(buildDir, "pretext-reader.xpi");
const updateJsonPath = resolve(buildDir, "update.json");
const manifestPath = resolve(addonDir, "manifest.json");
const manifestSource = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);
if (process.env.ZOTERO_ADDON_ID) {
  manifest.applications.zotero.id = process.env.ZOTERO_ADDON_ID;
}
if (process.env.ZOTERO_HOMEPAGE_URL) {
  manifest.homepage_url = process.env.ZOTERO_HOMEPAGE_URL;
}
const updateLink =
  process.env.ZOTERO_UPDATE_LINK ||
  "https://github.com/yourname/zotero-pretext-reader/releases/latest/download/pretext-reader.xpi";

mkdirSync(resolve(addonDir, "content"), { recursive: true });
if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true, force: true });
}
mkdirSync(buildDir, { recursive: true });

await build({
  entryPoints: [resolve(root, "src", "index.ts")],
  outfile: readerJs,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: false,
  minify: false,
});

for (const path of [xpiPath]) {
  if (existsSync(path)) {
    rmSync(path);
  }
}

try {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeZipFromDirectory(addonDir, xpiPath);
} finally {
  writeFileSync(manifestPath, manifestSource, "utf8");
}
const xpiHash = createHash("sha256").update(readFileSync(xpiPath)).digest("hex");

writeFileSync(
  updateJsonPath,
  JSON.stringify(
    {
      addons: {
        [manifest.applications.zotero.id]: {
          updates: [
            {
              version: manifest.version,
              update_link: updateLink,
              update_hash: `sha256:${xpiHash}`,
              applications: {
                zotero: {
                  strict_min_version: manifest.applications.zotero.strict_min_version,
                  strict_max_version: manifest.applications.zotero.strict_max_version,
                },
              },
            },
          ],
        },
      },
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Built ${readerJs}`);
console.log(`Packed ${xpiPath}`);
console.log(`Wrote ${updateJsonPath}`);
