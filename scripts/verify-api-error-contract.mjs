import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const backendRoot = resolve(root, "backend", "app");
const REMOTE_ERROR_CODES = ["URL_TIMEOUT", "URL_FETCH_FAILED", "ARXIV_TIMEOUT", "ARXIV_FETCH_FAILED"];

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function walkFiles(dir, extensions, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, extensions, files);
    } else if (extensions.includes(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

function fail(message) {
  throw new Error(message);
}

function extractStatusCodes() {
  const source = read("backend/app/services/validation_service.py");
  const match = source.match(/STATUS_BY_CODE\s*=\s*\{([\s\S]*?)\n\}/);
  if (!match) {
    fail("Could not find backend STATUS_BY_CODE.");
  }
  return new Map([...match[1].matchAll(/"([A-Z_]+)":\s*(\d+)/g)].map((item) => [item[1], Number(item[2])]));
}

function extractRaisedBackendCodes() {
  const codes = new Set();
  for (const file of walkFiles(backendRoot, [".py"])) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/FileValidationError\(\s*"([A-Z_]+)"/g)) {
      codes.add(match[1]);
    }
  }
  return [...codes].sort();
}

function extractFrontendErrorMap() {
  const source = read("frontend/src/lib/apiErrors.ts");
  const match = source.match(/API_ERROR_KEYS:[\s\S]*?=\s*\{([\s\S]*?)\n\}/);
  if (!match) {
    fail("Could not find frontend API_ERROR_KEYS.");
  }
  return new Map([...match[1].matchAll(/([A-Z_]+):\s*"([A-Za-z][A-Za-z0-9]*)"/g)].map((item) => [item[1], item[2]]));
}

function assertBackendCodesHaveStatuses(statusCodes, raisedCodes) {
  const missing = raisedCodes.filter((code) => !statusCodes.has(code));
  if (missing.length) {
    fail(`Backend FileValidationError codes missing STATUS_BY_CODE entries: ${missing.join(", ")}`);
  }
}

function assertFrontendMapsBackendCodes(statusCodes, frontendMap) {
  const missing = [...statusCodes.keys()].filter((code) => !frontendMap.has(code));
  if (missing.length) {
    fail(`Backend API error codes missing frontend API_ERROR_KEYS mappings: ${missing.join(", ")}`);
  }
}

function assertFrontendMappingsHaveTranslations(frontendMap) {
  const i18n = read("frontend/src/lib/i18n.ts");
  const missing = [];
  for (const [code, key] of frontendMap) {
    const matches = i18n.match(new RegExp(`\\b${key}:`, "g")) ?? [];
    if (matches.length !== 2) {
      missing.push(`${code} -> ${key}`);
    }
  }
  if (missing.length) {
    fail(`Frontend API error mappings must have en and zh translations:\n${missing.join("\n")}`);
  }
}

function assertRemoteErrorsAreDocumented() {
  const apiDoc = read("docs/API.md");
  const missing = REMOTE_ERROR_CODES.filter((code) => !apiDoc.includes(`\`${code}\``));
  if (missing.length) {
    fail(`docs/API.md is missing remote fetch error codes: ${missing.join(", ")}`);
  }
}

function assertExpectedStatusSemantics(statusCodes) {
  const expected = new Map([
    ["UNSUPPORTED_FORMAT", 400],
    ["FILE_TOO_LARGE", 413],
    ["ENCODING_ERROR", 422],
    ["CONTENT_REJECTED", 422],
    ["EMPTY_CONTENT", 422],
    ["URL_TIMEOUT", 504],
    ["URL_FETCH_FAILED", 502],
    ["ARXIV_TIMEOUT", 504],
    ["ARXIV_FETCH_FAILED", 502],
  ]);
  for (const [code, status] of expected) {
    if (statusCodes.get(code) !== status) {
      fail(`${code} must map to HTTP ${status}, found ${statusCodes.get(code) ?? "missing"}.`);
    }
  }
}

const statusCodes = extractStatusCodes();
const raisedCodes = extractRaisedBackendCodes();
const frontendMap = extractFrontendErrorMap();

assertBackendCodesHaveStatuses(statusCodes, raisedCodes);
assertFrontendMapsBackendCodes(statusCodes, frontendMap);
assertFrontendMappingsHaveTranslations(frontendMap);
assertRemoteErrorsAreDocumented();
assertExpectedStatusSemantics(statusCodes);

console.log("API error contract checks passed.");
