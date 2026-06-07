import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const isWindows = process.platform === "win32";
const backendVenvPython = isWindows
  ? resolve(root, "backend", ".venv", "Scripts", "python.exe")
  : resolve(root, "backend", ".venv", "bin", "python");
const pythonCommand = existsSync(backendVenvPython) ? backendVenvPython : isWindows ? "python" : "python3";

function npmRun(script) {
  if (process.env.npm_execpath) {
    return [process.execPath, process.env.npm_execpath, "run", script];
  }
  return [isWindows ? "npm.cmd" : "npm", "run", script];
}

const commands = [
  {
    name: "frontend source checks",
    cwd: root,
    command: [process.execPath, resolve(root, "scripts", "verify-frontend-source.mjs")],
  },
  {
    name: "upload validation contract checks",
    cwd: root,
    command: [process.execPath, resolve(root, "scripts", "verify-upload-contract.mjs")],
  },
  {
    name: "content input validation contract checks",
    cwd: root,
    command: [process.execPath, resolve(root, "scripts", "verify-input-contract.mjs")],
  },
  {
    name: "API error contract checks",
    cwd: root,
    command: [process.execPath, resolve(root, "scripts", "verify-api-error-contract.mjs")],
  },
  {
    name: "API documentation contract checks",
    cwd: root,
    command: [process.execPath, resolve(root, "scripts", "verify-api-docs-contract.mjs")],
  },
  {
    name: "sample article contract checks",
    cwd: root,
    command: [process.execPath, resolve(root, "scripts", "verify-samples-contract.mjs")],
  },
  {
    name: "backend tests",
    cwd: resolve(root, "backend"),
    command: [pythonCommand, "-m", "pytest"],
  },
  {
    name: "frontend build",
    cwd: resolve(root, "frontend"),
    command: npmRun("build"),
  },
  {
    name: "zotero plugin build",
    cwd: resolve(root, "zotero-plugin"),
    command: npmRun("build"),
  },
  {
    name: "zotero plugin verify",
    cwd: resolve(root, "zotero-plugin"),
    command: npmRun("verify"),
  },
];

for (const step of commands) {
  console.log(`\n==> ${step.name}`);
  execFileSync(step.command[0], step.command.slice(1), {
    cwd: step.cwd,
    stdio: "inherit",
  });
}

const expected = [
  "frontend/dist/index.html",
  "zotero-plugin/addon/content/reader.js",
  "zotero-plugin/build/pretext-reader.xpi",
  "zotero-plugin/build/update.json",
];

const missing = expected.filter((relativePath) => !existsSync(resolve(root, relativePath)));
if (missing.length > 0) {
  throw new Error(`Verification finished but expected artifacts are missing: ${missing.join(", ")}`);
}

console.log("\nAll Pretext Reader verification checks passed.");
