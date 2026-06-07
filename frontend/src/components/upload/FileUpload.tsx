import { useState } from "react";

import { useFileUpload } from "../../hooks/useFileUpload";
import { useReaderStore } from "../../store/readerStore";
import { FileInfoCard } from "./FileInfoCard";
import { UploadDropZone } from "./UploadDropZone";

export function FileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const upload = useFileUpload();
  const isLoading = useReaderStore((state) => state.isLoading);
  const contentSource = useReaderStore((state) => state.contentSource);
  const metadata = useReaderStore((state) => state.metadata);

  const onFileSelected = (file: File) => {
    if (isLoading) {
      return;
    }
    setSelectedFile(file);
    void upload(file);
  };

  return (
    <div className="upload-stack">
      <UploadDropZone disabled={isLoading} onFileSelected={onFileSelected} />
      {selectedFile ? <FileInfoCard file={selectedFile} metadata={contentSource === "file" ? metadata : null} /> : null}
    </div>
  );
}
