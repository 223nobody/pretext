const ARXIV_ID_PATTERN = /^\d{4}\.\d{4,5}(v\d+)?$|^[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(v\d+)?$/;

export type ContentInputValidationError = "requiredInput" | "invalidArxivId" | "invalidUrl";

export function validateArxivId(input: string): ContentInputValidationError | null {
  const value = input.trim();
  if (!value) {
    return "requiredInput";
  }
  return ARXIV_ID_PATTERN.test(value) ? null : "invalidArxivId";
}

export function validateArticleUrl(input: string): ContentInputValidationError | null {
  const value = input.trim();
  if (!value) {
    return "requiredInput";
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? null : "invalidUrl";
  } catch {
    return "invalidUrl";
  }
}

export function validateTextInput(input: string): ContentInputValidationError | null {
  return input.trim() ? null : "requiredInput";
}

export type SmartInputKind = "arxiv" | "url" | "text" | "empty";

/**
 * ArXiv abstract-page URL pattern. When a user pastes
 * `https://arxiv.org/abs/2606.07436` we classify it as an ArXiv ID rather than
 * a generic URL so the ArXiv API (which returns clean full-text) is used.
 */
const ARXIV_ABS_RE = /^https?:\/\/arxiv\.org\/abs\/([^/\s?#]+)/i;

/**
 * Classifies a single input string for the unified smart input
 * (see NEXT_DEVELOPMENT_PLAN §6.1.1):
 *   - arxiv.org/abs/<id>                          → arxiv
 *   - starts with any other http:// or https://   → url
 *   - matches an ArXiv ID pattern as a lone token → arxiv
 *   - non-empty                                   → text
 */
export function classifyInput(input: string): SmartInputKind {
  const value = input.trim();
  if (!value) {
    return "empty";
  }
  // arxiv.org/abs/<id> URLs go to the ArXiv endpoint.
  if (ARXIV_ABS_RE.test(value)) {
    return "arxiv";
  }
  if (/^https?:\/\//i.test(value)) {
    return "url";
  }
  const bare = value.replace(/^arxiv:\s*/i, "").trim();
  if (!/\s/.test(bare) && ARXIV_ID_PATTERN.test(bare)) {
    return "arxiv";
  }
  return "text";
}

/**
 * Normalises user input to a bare ArXiv ID suitable for the API.
 * Handles:
 *   arxiv:2301.12345  → 2301.12345
 *   https://arxiv.org/abs/2606.07436 → 2606.07436
 */
export function normalizeArxivId(input: string): string {
  const trimmed = input.trim();
  const absMatch = trimmed.match(ARXIV_ABS_RE);
  if (absMatch) {
    return absMatch[1];
  }
  return trimmed.replace(/^arxiv:\s*/i, "").trim();
}
