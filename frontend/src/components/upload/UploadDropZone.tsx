import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { FileUp } from "lucide-react";

import { ALLOWED_EXTENSIONS } from "../../../../shared/types/validation";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

const ACCEPTED_DOCUMENT_TYPES = ALLOWED_EXTENSIONS.join(",");

interface UploadDropZoneProps {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

export function UploadDropZone({ disabled = false, onFileSelected }: UploadDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const language = useReaderStore((state) => state.language);

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) {
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <>
      <button
        className={`drop-zone ${isDragging ? "is-dragging" : ""}`}
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (disabled) {
            return;
          }
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <FileUp size={18} />
        <span>{t(language, "chooseFile")}</span>
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        aria-label={t(language, "chooseFileInput")}
        accept={ACCEPTED_DOCUMENT_TYPES}
        disabled={disabled}
        onChange={pickFile}
      />
    </>
  );
}
