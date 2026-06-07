import { FormEvent, useState } from "react";
import { Link } from "lucide-react";

import { fetchUrl } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { t } from "../../lib/i18n";
import { validateArticleUrl } from "../../lib/inputValidation";
import { useReaderStore } from "../../store/readerStore";

export function UrlInput() {
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
    const validationError = validateArticleUrl(value);
    if (validationError) {
      setError(t(language, validationError));
      return;
    }
    const url = value.trim();
    setLoading(true, 30);
    try {
      const article = await fetchUrl(url);
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
      setValue("");
    } catch (error) {
      setError(getApiErrorMessage(language, error, "urlFetchFailed"));
    }
  };

  return (
    <form className="inline-form" onSubmit={onSubmit}>
      <input
        value={value}
        placeholder="https://..."
        aria-label={t(language, "urlInput")}
        disabled={isLoading}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="submit"
        title={t(language, "fetchUrl")}
        aria-label={t(language, "fetchUrl")}
        disabled={isLoading}
      >
        <Link size={16} />
      </button>
    </form>
  );
}
