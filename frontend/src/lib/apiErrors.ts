import { ApiClientError } from "./api";
import { t, type TranslationKey } from "./i18n";
import type { Language } from "../types";

const API_ERROR_KEYS: Record<string, TranslationKey> = {
  NETWORK_ERROR: "networkError",
  INVALID_RESPONSE: "invalidResponse",
  REQUEST_FAILED: "requestFailed",
  HTTP_ERROR: "requestFailed",
  UNSUPPORTED_FORMAT: "unsupportedFormat",
  FILE_TOO_LARGE: "apiFileTooLarge",
  ENCODING_ERROR: "encodingError",
  CONTENT_REJECTED: "contentRejected",
  EMPTY_CONTENT: "emptyContent",
  URL_TIMEOUT: "urlTimeout",
  URL_FETCH_FAILED: "urlFetchFailed",
  ARXIV_TIMEOUT: "arxivTimeout",
  ARXIV_FETCH_FAILED: "arxivFetchFailed",
};

export function getApiErrorMessage(
  language: Language,
  error: unknown,
  fallbackKey: TranslationKey,
): string {
  if (error instanceof ApiClientError) {
    const key = API_ERROR_KEYS[error.code];
    return t(language, key ?? fallbackKey);
  }

  return t(language, fallbackKey);
}
