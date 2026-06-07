import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { listZipEntries, readZipEntry } from "./zip-utils.mjs";

const root = resolve(import.meta.dirname, "..");
const buildDir = resolve(root, "build");
const xpiPath = resolve(buildDir, "pretext-reader.xpi");
const updateJsonPath = resolve(buildDir, "update.json");

if (!existsSync(xpiPath)) {
  throw new Error(`Missing XPI: ${xpiPath}`);
}
if (!existsSync(updateJsonPath)) {
  throw new Error(`Missing update.json: ${updateJsonPath}`);
}

const required = [
  "manifest.json",
  "bootstrap.js",
  "content/reader.html",
  "content/reader.js",
  "locale/en-US/prefs.ftl",
  "locale/zh-CN/prefs.ftl",
];

const entries = new Set(listZipEntries(xpiPath));
const missing = required.filter((entry) => !entries.has(entry));
if (missing.length > 0) {
  throw new Error(`XPI is missing required files: ${missing.join(", ")}`);
}

const sourceUi = readFileSync(resolve(root, "src", "ui.ts"), "utf8");
const sourceApi = readFileSync(resolve(root, "src", "zotero-api.ts"), "utf8");
const sourceBridge = readFileSync(resolve(root, "src", "pretext-bridge.ts"), "utf8");
const bundledReader = readZipEntry(xpiPath, "content/reader.js").toString("utf8");
const uiContractSnippets = [
  "private menuItemId = \"pretext-reader-open-item\";",
  "private toolbarButtonId = \"pretext-reader-toolbar-button\";",
  "this.registerMenuItem();",
  "this.registerToolbarButton();",
  "documentRef?.getElementById(this.menuItemId)?.remove();",
  "documentRef?.getElementById(this.toolbarButtonId)?.remove();",
  "documentRef.createXULElement(\"menuitem\")",
  "documentRef.createXULElement(\"toolbarbutton\")",
  "void this.openSelectedItem();",
];
const missingUiSource = uiContractSnippets.filter((snippet) => !sourceUi.includes(snippet));
if (missingUiSource.length > 0) {
  throw new Error(`Zotero UI source is missing required launch surfaces: ${missingUiSource.join(", ")}`);
}
for (const bundledSnippet of ["pretext-reader-open-item", "pretext-reader-toolbar-button", "zotero-items-toolbar"]) {
  if (!bundledReader.includes(bundledSnippet)) {
    throw new Error(`Bundled reader.js is missing Zotero UI launch surface: ${bundledSnippet}`);
  }
}
const apiContractSnippets = [
  'item.getField("title") || "Untitled item"',
  'item.getField("abstractNote") || ""',
  "authors: readAuthors(item)",
  "{ label: \"Abstract\", text: abstract }",
  "{ label: \"Notes\", text: notesText }",
  "{ label: \"Attachments\", text: attachmentText }",
  "item.getCreators?.()",
  "item.getNotes?.()",
  "stripHtml(noteText)",
  "item.getAttachments?.()",
  "attachment.isPDFAttachment?.()",
  'attachment.attachmentContentType === "application/pdf"',
  'attachment.getField?.("contentType") === "application/pdf"',
  "fulltext.getItemText?.(itemId)",
  "fulltext.getItemCacheFileContents?.(itemId)",
  "readAttachmentFileText(attachment)",
];
const missingApiContract = apiContractSnippets.filter((snippet) => !sourceApi.includes(snippet));
if (missingApiContract.length > 0) {
  throw new Error(`Zotero item synchronization contract is incomplete: ${missingApiContract.join(", ")}`);
}
const bridgeContractSnippets = [
  "payload.title || \"Untitled item\"",
  "payload.authors.join(\", \")",
  "payload.sources.join(\", \")",
  "payload.text",
];
const missingBridgeContract = bridgeContractSnippets.filter((snippet) => !sourceBridge.includes(snippet));
if (missingBridgeContract.length > 0) {
  throw new Error(`Zotero reader payload rendering contract is incomplete: ${missingBridgeContract.join(", ")}`);
}
for (const bundledSnippet of ["Abstract", "Notes", "Attachments", "getItemText", "getItemCacheFileContents"]) {
  if (!bundledReader.includes(bundledSnippet)) {
    throw new Error(`Bundled reader.js is missing Zotero item synchronization behavior: ${bundledSnippet}`);
  }
}

const updateJson = JSON.parse(readFileSync(updateJsonPath, "utf8"));
const xpiManifest = JSON.parse(readZipEntry(xpiPath, "manifest.json").toString("utf8"));
const addonId = xpiManifest.applications?.zotero?.id;
if (!addonId) {
  throw new Error("XPI manifest is missing applications.zotero.id");
}

const addon = updateJson.addons?.[addonId];
if (!addon) {
  throw new Error("update.json add-on id does not match XPI manifest id");
}
const update = addon?.updates?.[0];
if (!update?.update_hash?.startsWith("sha256:")) {
  throw new Error("update.json is missing sha256 update_hash");
}
if (update.version !== xpiManifest.version) {
  throw new Error("update.json version does not match XPI manifest version");
}
if (
  update.applications?.zotero?.strict_min_version !== xpiManifest.applications.zotero.strict_min_version ||
  update.applications?.zotero?.strict_max_version !== xpiManifest.applications.zotero.strict_max_version
) {
  throw new Error("update.json Zotero version range does not match XPI manifest");
}

const actualHash = `sha256:${createHash("sha256").update(readFileSync(xpiPath)).digest("hex")}`;
if (update.update_hash !== actualHash) {
  throw new Error("update.json hash does not match XPI contents");
}

console.log("XPI package verified");
