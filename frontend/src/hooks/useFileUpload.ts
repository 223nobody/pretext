import { uploadFile } from "../lib/api";
import { getApiErrorMessage } from "../lib/apiErrors";
import {
  formatBytes,
  MAX_FILE_SIZE,
  validateClientFile,
  type ClientFileValidationError,
} from "../lib/fileValidation";
import { t } from "../lib/i18n";
import { useReaderStore } from "../store/readerStore";
import type { Language } from "../types";

function getValidationMessage(language: Language, error: ClientFileValidationError): string {
  if (error === "fileTooLarge") {
    return `${t(language, "fileTooLarge")} ${formatBytes(MAX_FILE_SIZE)}.`;
  }
  return t(language, error);
}

export function useFileUpload() {
  const setLoading = useReaderStore((state) => state.setLoading);
  const setContent = useReaderStore((state) => state.setContent);
  const setError = useReaderStore((state) => state.setError);
  const language = useReaderStore((state) => state.language);

  return async (file: File) => {
    const validationError = validateClientFile(file);
    if (validationError) {
      setError(getValidationMessage(language, validationError));
      return;
    }

    setLoading(true, 20);
    try {
      const result = await uploadFile(file);
      setContent(
        result.text,
        {
          title: String(result.metadata.title ?? result.file_name),
          fileName: result.file_name,
          fileSize: result.file_size,
          mimeType: result.mime_type,
          preview: result.preview,
          cachedUntil: result.cached_until,
          source: "file",
        },
        "file",
      );
    } catch (error) {
      setError(getApiErrorMessage(language, error, "uploadFailed"));
    }
  };
}
