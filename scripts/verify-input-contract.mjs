import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const EXPECTED_ARXIV_PATTERN = String.raw`\d{4}\.\d{4,5}(v\d+)?$|^[a-z-]+(?:\.[A-Z]{2})?/\d{7}(v\d+)?`;

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function normalizeRegexPattern(pattern) {
  return pattern.replaceAll(String.raw`\/`, "/");
}

function extractFrontendArxivPattern(source) {
  const match = source.match(/const ARXIV_ID_PATTERN = \/\^([\s\S]*?)\$\/;/);
  if (!match) {
    fail("Could not find frontend ARXIV_ID_PATTERN.");
  }
  return normalizeRegexPattern(match[1]);
}

function extractBackendArxivPattern(source) {
  const match = source.match(/ARXIV_RE = re\.compile\(r"\^([\s\S]*?)\$"\)/);
  if (!match) {
    fail("Could not find backend ARXIV_RE.");
  }
  return match[1];
}

function assertArxivValidationContract() {
  const frontend = read("frontend/src/lib/inputValidation.ts");
  const backend = read("backend/app/services/arxiv_service.py");
  const types = read("frontend/src/types/index.ts");
  const arxivInput = read("frontend/src/components/content/ArXivInput.tsx");
  const apiDoc = read("docs/API.md");

  if (extractFrontendArxivPattern(frontend) !== EXPECTED_ARXIV_PATTERN) {
    fail("frontend ArXiv ID validation pattern is not aligned with the expected contract.");
  }
  if (extractBackendArxivPattern(backend) !== EXPECTED_ARXIV_PATTERN) {
    fail("backend ArXiv ID validation pattern is not aligned with the expected contract.");
  }
  if (!arxivInput.includes('import { validateArxivId } from "../../lib/inputValidation";')) {
    fail("ArXivInput must use the shared frontend validateArxivId helper.");
  }
  if (!arxivInput.includes("const validationError = validateArxivId(value);")) {
    fail("ArXivInput must validate before fetching.");
  }
  if (!arxivInput.includes("setError(t(language, validationError));")) {
    fail("ArXivInput validation errors must use localized messages.");
  }

  for (const snippet of [
    '"full_text": full_text',
    '"full_text_source": full_text_source',
    '"pdf_url": pdf_url',
    'full_text_source = "abstract"',
    'full_text_source = "pdf"',
  ]) {
    if (!backend.includes(snippet)) {
      fail(`backend ArXiv response is missing full-text source contract snippet: ${snippet}`);
    }
  }

  for (const snippet of [
    'fullTextSource?: "abstract" | "pdf";',
    "pdfUrl?: string | null;",
    'full_text_source: "abstract" | "pdf";',
    "pdf_url: string | null;",
  ]) {
    if (!types.includes(snippet)) {
      fail(`frontend ArXiv types are missing full-text source contract snippet: ${snippet}`);
    }
  }

  for (const snippet of ["fullTextSource: paper.full_text_source", "pdfUrl: paper.pdf_url"]) {
    if (!arxivInput.includes(snippet)) {
      fail(`ArXivInput must preserve ArXiv full-text metadata: ${snippet}`);
    }
  }

  for (const snippet of ["`full_text_source` is `abstract`", "`full_text_source` is `pdf`"]) {
    if (!apiDoc.includes(snippet)) {
      fail(`docs/API.md is missing ArXiv full-text source documentation: ${snippet}`);
    }
  }
}

function assertUrlValidationContract() {
  const frontend = read("frontend/src/lib/inputValidation.ts");
  const backend = read("backend/app/services/url_service.py");
  const types = read("frontend/src/types/index.ts");
  const urlInput = read("frontend/src/components/content/UrlInput.tsx");
  const apiDoc = read("docs/API.md");

  if (!frontend.includes('url.protocol === "http:" || url.protocol === "https:"')) {
    fail("frontend URL validation must allow only http and https protocols.");
  }
  if (!backend.includes('parsed.scheme not in {"http", "https"}')) {
    fail("backend URL validation must allow only http and https schemes.");
  }
  if (!urlInput.includes('import { validateArticleUrl } from "../../lib/inputValidation";')) {
    fail("UrlInput must use the shared frontend validateArticleUrl helper.");
  }
  if (!urlInput.includes("const validationError = validateArticleUrl(value);")) {
    fail("UrlInput must validate before fetching.");
  }
  if (!urlInput.includes("setError(t(language, validationError));")) {
    fail("UrlInput validation errors must use localized messages.");
  }

  for (const snippet of [
    '"url": url',
    '"title": title or site_name',
    '"author": author',
    '"site_name": site_name',
    '"char_count": len(text)',
    '"excerpt": text[:500]',
  ]) {
    if (!backend.includes(snippet)) {
      fail(`backend URL response is missing metadata contract snippet: ${snippet}`);
    }
  }

  for (const snippet of [
    "url?: string;",
    "siteName?: string;",
    "charCount?: number;",
    "excerpt?: string;",
    "url: string;",
    "site_name: string;",
    "char_count: number;",
    "excerpt: string;",
  ]) {
    if (!types.includes(snippet)) {
      fail(`frontend URL types are missing metadata contract snippet: ${snippet}`);
    }
  }

  for (const snippet of [
    "url: article.url",
    "siteName: article.site_name",
    "charCount: article.char_count",
    "excerpt: article.excerpt",
    "source: article.site_name",
  ]) {
    if (!urlInput.includes(snippet)) {
      fail(`UrlInput must preserve URL metadata: ${snippet}`);
    }
  }

  for (const snippet of ["`POST /url/fetch`", '"url": "https://example.com/article"', '"max_chars": 300000']) {
    if (!apiDoc.includes(snippet)) {
      fail(`docs/API.md is missing URL fetch contract snippet: ${snippet}`);
    }
  }
}

function assertTextExtractionContract() {
  const backend = read("backend/app/api/text_extract.py");
  const types = read("frontend/src/types/index.ts");
  const api = read("frontend/src/lib/api.ts");
  const textInput = read("frontend/src/components/content/TextInput.tsx");
  const smartInput = read("frontend/src/components/content/SmartInput.tsx");
  const sidebar = read("frontend/src/components/layout/Sidebar.tsx");
  const apiDoc = read("docs/API.md");

  for (const snippet of [
    '"text": text',
    '"char_count": len(text)',
    '"preview": text[: settings.max_preview_chars]',
    '"truncated": truncated',
    '"metadata": {"source": "text"}',
  ]) {
    if (!backend.includes(snippet)) {
      fail(`backend text extraction response is missing contract field: ${snippet}`);
    }
  }

  for (const snippet of [
    'export type ContentSource = "arxiv" | "url" | "file" | "text";',
    "export interface TextExtractResult",
    "char_count: number;",
    "preview: string;",
    "truncated: boolean;",
    "source?: string;",
  ]) {
    if (!types.includes(snippet)) {
      fail(`frontend types are missing text extraction contract snippet: ${snippet}`);
    }
  }

  for (const snippet of [
    "TextExtractResult",
    "export async function extractText",
    '`${API_URL}/text/extract`',
    "JSON.stringify({ text, max_chars: maxChars })",
  ]) {
    if (!api.includes(snippet)) {
      fail(`frontend API client is missing text extraction contract snippet: ${snippet}`);
    }
  }

  for (const snippet of [
    'import { extractText } from "../../lib/api";',
    'import { validateTextInput } from "../../lib/inputValidation";',
    "const validationError = validateTextInput(value);",
    "const result = await extractText(value);",
    'title: t(language, "pastedTextTitle")',
    '"text"',
    'setError(getApiErrorMessage(language, error, "textLoadFailed"));',
  ]) {
    if (!textInput.includes(snippet)) {
      fail(`TextInput is missing text extraction contract snippet: ${snippet}`);
    }
  }

  const sidebarExposesLegacyTextInput =
    sidebar.includes('import { TextInput } from "../content/TextInput";') &&
    sidebar.includes("<TextInput />");
  const sidebarExposesSmartInput =
    sidebar.includes('import { SmartInput } from "../content/SmartInput";') &&
    sidebar.includes("<SmartInput />") &&
    smartInput.includes('import { extractText') &&
    smartInput.includes("const result = await extractText(value);") &&
    smartInput.includes('"text"');

  if (!sidebarExposesLegacyTextInput && !sidebarExposesSmartInput) {
    fail("Sidebar must expose the text extraction input source.");
  }

  for (const snippet of [
    "### `POST /text/extract`",
    '"char_count": 12',
    '"preview": "Hello reader"',
    '"truncated": false',
    '"source": "text"',
    "`CONTENT_REJECTED`",
    "`EMPTY_CONTENT`",
    "`MAX_TEXT_CHARS`",
  ]) {
    if (!apiDoc.includes(snippet)) {
      fail(`docs/API.md is missing text extraction contract snippet: ${snippet}`);
    }
  }
}

function assertInputValidationMessages() {
  const i18n = read("frontend/src/lib/i18n.ts");
  for (const key of ["requiredInput", "invalidArxivId", "invalidUrl"]) {
    const matches = i18n.match(new RegExp(`\\b${key}:`, "g")) ?? [];
    if (matches.length !== 2) {
      fail(`i18n must define ${key} in both en and zh dictionaries.`);
    }
  }
}

assertArxivValidationContract();
assertUrlValidationContract();
assertTextExtractionContract();
assertInputValidationMessages();

console.log("Content input validation contract checks passed.");
