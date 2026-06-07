import { FileText } from "lucide-react";

import { formatBytes } from "../../lib/fileValidation";
import type { ArticleMetadata } from "../../types";

interface FileInfoCardProps {
  file: File;
  metadata?: ArticleMetadata | null;
}

export function FileInfoCard({ file, metadata }: FileInfoCardProps) {
  const fileSize = metadata?.fileSize ?? file.size;
  const fileType = metadata?.mimeType ?? file.type;
  const preview = metadata?.preview;

  return (
    <div className="file-info">
      <FileText size={16} />
      <div>
        <strong>{file.name}</strong>
        <span>{[formatBytes(fileSize), fileType].filter(Boolean).join(" · ")}</span>
        {preview ? <span className="file-preview">{preview}</span> : null}
      </div>
    </div>
  );
}
