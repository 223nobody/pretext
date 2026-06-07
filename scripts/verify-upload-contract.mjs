import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const EXPECTED_MAX_FILE_SIZE = 50 * 1024 * 1024;

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function extractTsExtensions(source) {
  const match = source.match(/ALLOWED_EXTENSIONS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!match) {
    fail("Could not find shared ALLOWED_EXTENSIONS.");
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function extractPythonSet(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) {
    fail(`Could not find backend ${name}.`);
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function sameItems(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertSameItems(label, left, right) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  if (!sameItems(sortedLeft, sortedRight)) {
    fail(`${label} mismatch.\nleft: ${sortedLeft.join(", ")}\nright: ${sortedRight.join(", ")}`);
  }
}

function assertSharedValidation() {
  const source = read("shared/types/validation.ts");
  const extensions = extractTsExtensions(source);
  if (new Set(extensions).size !== extensions.length) {
    fail(`shared ALLOWED_EXTENSIONS contains duplicates: ${extensions.join(", ")}`);
  }
  if (!source.includes(`export const MAX_FILE_SIZE = 50 * 1024 * 1024;`)) {
    fail("shared MAX_FILE_SIZE must remain the documented 50 MiB default.");
  }
  return extensions;
}

function assertBackendMatchesShared(sharedExtensions) {
  const source = read("backend/app/services/validation_service.py");
  assertSameItems("backend ALLOWED_EXTENSIONS", sharedExtensions, extractPythonSet(source, "ALLOWED_EXTENSIONS"));

  const textExtensions = extractPythonSet(source, "TEXT_EXTENSIONS");
  const missingTextExtensions = textExtensions.filter((extension) => !sharedExtensions.includes(extension));
  if (missingTextExtensions.length) {
    fail(`backend TEXT_EXTENSIONS includes unsupported upload formats: ${missingTextExtensions.join(", ")}`);
  }

  const config = read("backend/app/config.py");
  if (!config.includes(`50 * 1024 * 1024`)) {
    fail("backend default MAX_FILE_SIZE must remain aligned with shared 50 MiB default.");
  }
}

function assertFrontendMatchesShared() {
  const validation = read("frontend/src/lib/fileValidation.ts");
  if (!validation.includes('import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from "../../../shared/types/validation";')) {
    fail("frontend file validation must import ALLOWED_EXTENSIONS and MAX_FILE_SIZE from shared/types/validation.");
  }

  const dropZone = read("frontend/src/components/upload/UploadDropZone.tsx");
  if (!dropZone.includes('import { ALLOWED_EXTENSIONS } from "../../../../shared/types/validation";')) {
    fail("UploadDropZone must derive its accept list from shared/types/validation.");
  }
  if (!dropZone.includes("const ACCEPTED_DOCUMENT_TYPES = ALLOWED_EXTENSIONS.join(\",\");")) {
    fail("UploadDropZone accept list must be generated from ALLOWED_EXTENSIONS.");
  }
  if (!dropZone.includes("accept={ACCEPTED_DOCUMENT_TYPES}")) {
    fail("UploadDropZone file input must use the shared accept list.");
  }

  const types = read("frontend/src/types/index.ts");
  for (const snippet of ["fileSize?: number;", "mimeType?: string;", "preview?: string;", "cachedUntil?: string;"]) {
    if (!types.includes(snippet)) {
      fail(`ArticleMetadata must preserve upload result metadata for file previews: ${snippet}`);
    }
  }

  const uploadHook = read("frontend/src/hooks/useFileUpload.ts");
  for (const snippet of [
    "fileSize: result.file_size",
    "mimeType: result.mime_type",
    "preview: result.preview",
    "cachedUntil: result.cached_until",
  ]) {
    if (!uploadHook.includes(snippet)) {
      fail(`useFileUpload must preserve upload result metadata: ${snippet}`);
    }
  }

  const fileUpload = read("frontend/src/components/upload/FileUpload.tsx");
  if (!fileUpload.includes('contentSource === "file" ? metadata : null')) {
    fail("FileUpload must pass successful file metadata into FileInfoCard.");
  }

  const fileInfo = read("frontend/src/components/upload/FileInfoCard.tsx");
  for (const snippet of [
    "metadata?.fileSize ?? file.size",
    "metadata?.mimeType ?? file.type",
    "metadata?.preview",
    'className="file-preview"',
  ]) {
    if (!fileInfo.includes(snippet)) {
      fail(`FileInfoCard must show uploaded file metadata and preview: ${snippet}`);
    }
  }
}

function assertDocsMatchShared(sharedExtensions) {
  const apiDoc = read("docs/API.md");
  const documentedExtensions = [...apiDoc.matchAll(/`(\.[a-z0-9]+)`/g)].map((match) => match[1]);
  for (const extension of sharedExtensions) {
    if (!documentedExtensions.includes(extension)) {
      fail(`docs/API.md is missing supported extension ${extension}.`);
    }
  }
  if (!apiDoc.includes(`52428800`)) {
    fail("docs/API.md must document the default MAX_FILE_SIZE value 52428800.");
  }
}

const sharedExtensions = assertSharedValidation();
assertBackendMatchesShared(sharedExtensions);
assertFrontendMatchesShared();
assertDocsMatchShared(sharedExtensions);

if (EXPECTED_MAX_FILE_SIZE !== 52_428_800) {
  fail("Internal max-file-size invariant is wrong.");
}

console.log("Upload validation contract checks passed.");
