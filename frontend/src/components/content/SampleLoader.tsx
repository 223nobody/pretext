import { Library } from "lucide-react";

import { useFileUpload } from "../../hooks/useFileUpload";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

const SAMPLE_PDF_URL = "/samples/attention-is-all-you-need.pdf";
const SAMPLE_PDF_NAME = "attention-is-all-you-need.pdf";

export function SampleLoader() {
  const setError = useReaderStore((state) => state.setError);
  const isLoading = useReaderStore((state) => state.isLoading);
  const language = useReaderStore((state) => state.language);
  const upload = useFileUpload();

  const loadSampleArticle = async () => {
    if (isLoading) {
      return;
    }

    try {
      const response = await fetch(`${SAMPLE_PDF_URL}?v=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Could not load bundled sample PDF: ${response.status}`);
      }

      const blob = await response.blob();
      const file = new File([blob], SAMPLE_PDF_NAME, { type: "application/pdf" });
      await upload(file);
    } catch (error) {
      setError(getApiErrorMessage(language, error, "sampleLoadFailed"));
    }
  };

  return (
    <div className="sample-row">
      <Library size={16} />
      <button
        type="button"
        aria-label={t(language, "loadSampleArticle")}
        disabled={isLoading}
        onClick={() => void loadSampleArticle()}
      >
        {t(language, "loadSampleArticle")}
      </button>
    </div>
  );
}
