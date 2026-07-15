import { FormEvent, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { extractText, fetchUrl, getArxiv } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { t } from "../../lib/i18n";
import { classifyInput, normalizeArxivId } from "../../lib/inputValidation";
import { useReaderStore } from "../../store/readerStore";

/**
 * Unified content input (NEXT_DEVELOPMENT_PLAN §6.1.1). A single field that
 * auto-detects whether the user typed an ArXiv ID, a URL, or plain text and
 * routes to the matching backend call — replacing the three separate
 * ArXiv/URL/Text input components in the sidebar.
 */
export function SmartInput() {
  const [value, setValue] = useState("");
  const setLoading = useReaderStore((state) => state.setLoading);
  const setContent = useReaderStore((state) => state.setContent);
  const setError = useReaderStore((state) => state.setError);
  const isLoading = useReaderStore((state) => state.isLoading);
  const language = useReaderStore((state) => state.language);

  const kind = useMemo(() => classifyInput(value), [value]);

  const hint = useMemo(() => {
    switch (kind) {
      case "arxiv":
        return t(language, "detectedArxiv");
      case "url":
        return t(language, "detectedUrl");
      case "text":
        return t(language, "detectedText");
      default:
        return "";
    }
  }, [kind, language]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }
    if (kind === "empty") {
      setError(t(language, "requiredInput"));
      return;
    }

    setLoading(true, 25);
    try {
      if (kind === "arxiv") {
        const id = normalizeArxivId(value);
        const paper = await getArxiv(id);
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
      } else if (kind === "url") {
        const article = await fetchUrl(value.trim());
        setContent(
          article.text,
          {
            title: article.title,
            author: article.author,
            url: article.url,
            siteName: article.site_name,
            charCount: article.char_count,
            excerpt: article.excerpt,
            source: article.site_name,
          },
          "url",
        );
      } else {
        const result = await extractText(value);
        setContent(
          result.text,
          {
            title: t(language, "pastedTextTitle"),
            source: result.metadata.source ?? "text",
          },
          "text",
        );
      }
      setValue("");
    } catch (error) {
      const fallbackKey =
        kind === "arxiv"
          ? "arxivFetchFailed"
          : kind === "url"
            ? "urlFetchFailed"
            : "textLoadFailed";
      setError(getApiErrorMessage(language, error, fallbackKey));
    }
  };

  return (
    <form className="smart-input" onSubmit={onSubmit}>
      <div className="smart-input-row">
        <textarea
          className="smart-input-field"
          value={value}
          placeholder={t(language, "smartInput")}
          aria-label={t(language, "smartInput")}
          disabled={isLoading}
          rows={2}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Enter submits; Shift+Enter inserts a newline (for pasted text).
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSubmit(event as unknown as FormEvent);
            }
          }}
        />
        <button
          type="submit"
          className="smart-input-submit"
          title={t(language, "smartLoad")}
          aria-label={t(language, "smartLoad")}
          disabled={isLoading}
        >
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="smart-input-hint" aria-live="polite">
        {hint}
      </div>
    </form>
  );
}
