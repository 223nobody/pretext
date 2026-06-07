import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from "../../../shared/types/validation";

export { MAX_FILE_SIZE };

export type ClientFileValidationError = "unsupportedFileType" | "fileTooLarge" | "fileEmpty";

export function validateClientFile(file: File): ClientFileValidationError | null {
  const lower = file.name.toLowerCase();
  const allowed = ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
  if (!allowed) {
    return "unsupportedFileType";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "fileTooLarge";
  }
  if (file.size === 0) {
    return "fileEmpty";
  }
  return null;
}

export function formatBytes(size: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  for (const unit of units) {
    if (value < 1024) {
      return `${value.toFixed(value < 10 && unit !== "B" ? 1 : 0)} ${unit}`;
    }
    value /= 1024;
  }
  return `${value.toFixed(1)} TB`;
}
