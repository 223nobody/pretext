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
