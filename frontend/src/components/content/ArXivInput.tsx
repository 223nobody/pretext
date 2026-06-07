import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

import { getArxiv } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { t } from "../../lib/i18n";
import { validateArxivId } from "../../lib/inputValidation";
import { useReaderStore } from "../../store/readerStore";

export function ArXivInput() {
  const [value, setValue] = useState("");
  const setLoading = useReaderStore((state) => state.setLoading);
  const setContent = useReaderStore((state) => state.setContent);
  const setError = useReaderStore((state) => state.setError);
  const isLoading = useReaderStore((state) => state.isLoading);
  const language = useReaderStore((state) => state.language);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }
    const validationError = validateArxivId(value);
    if (validationError) {
      setError(t(language, validationError));
      return;
    }
    const arxivId = value.trim();
    setLoading(true, 30);
    try {
      const paper = await getArxiv(arxivId);
      setContent(
        paper.full_text || paper.abstract,
        {
          title: paper.title,
          author: paper.authors,
          published: paper.published,
          categories: paper.categories,
          fullTextSource: paper.full_text_source,
          pdfUrl: paper.pdf_url,
          source: `arXiv:${paper.arxiv_id}`,
        },
        "arxiv",
      );
      setValue("");
    } catch (error) {
      setError(getApiErrorMessage(language, error, "arxivFetchFailed"));
    }
  };

  return (
    <form className="inline-form" onSubmit={onSubmit}>
      <input
        value={value}
        placeholder="2301.12345"
        aria-label={t(language, "arxivInput")}
        disabled={isLoading}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="submit"
        title={t(language, "fetchArxiv")}
        aria-label={t(language, "fetchArxiv")}
        disabled={isLoading}
      >
        <Search size={16} />
      </button>
    </form>
  );
}
