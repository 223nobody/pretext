import { AlertCircle, RotateCcw } from "lucide-react";

import { PageCanvas } from "../reader/PageCanvas";
import { Skeleton } from "../ui/Skeleton";
import { IconButton } from "../ui/IconButton";
import { UploadProgress } from "../upload/UploadProgress";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

export function ReaderArea() {
  const text = useReaderStore((state) => state.text);
  const metadata = useReaderStore((state) => state.metadata);
  const isLoading = useReaderStore((state) => state.isLoading);
  const loadingProgress = useReaderStore((state) => state.loadingProgress);
  const error = useReaderStore((state) => state.error);
  const clearError = useReaderStore((state) => state.clearError);
  const language = useReaderStore((state) => state.language);

  return (
    <section className="reader-area">
      <header className="reader-header">
        <div>
          <p className="eyebrow">{metadata?.source ?? t(language, "ready")}</p>
          <h2>{metadata?.title ?? t(language, "readyTitle")}</h2>
        </div>
        <div className="reader-meta">
          {Array.isArray(metadata?.author) ? metadata.author.join(", ") : metadata?.author}
        </div>
      </header>

      {error ? (
        <div className="notice error-notice">
          <AlertCircle size={18} />
          <span>{error}</span>
          <IconButton icon={RotateCcw} label={t(language, "dismissError")} onClick={clearError} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="loading-surface">
          <Skeleton />
          <UploadProgress value={loadingProgress} label={t(language, "uploadProgress")} />
        </div>
      ) : (
        <PageCanvas text={text} />
      )}
    </section>
  );
}
