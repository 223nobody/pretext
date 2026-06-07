import { FormEvent, useState } from "react";
import { FileText } from "lucide-react";

import { extractText } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { t } from "../../lib/i18n";
import { validateTextInput } from "../../lib/inputValidation";
import { useReaderStore } from "../../store/readerStore";

export function TextInput() {
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
    const validationError = validateTextInput(value);
    if (validationError) {
      setError(t(language, validationError));
      return;
    }

    setLoading(true, 20);
    try {
      const result = await extractText(value);
      setContent(
        result.text,
        {
          title: t(language, "pastedTextTitle"),
          source: result.metadata.source ?? "text",
        },
        "text",
      );
      setValue("");
    } catch (error) {
      setError(getApiErrorMessage(language, error, "textLoadFailed"));
    }
  };

  return (
    <form className="text-source-form" onSubmit={onSubmit}>
      <textarea
        value={value}
        placeholder={t(language, "pasteText")}
        aria-label={t(language, "textInput")}
        disabled={isLoading}
        rows={4}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" disabled={isLoading}>
        <FileText size={16} />
        <span>{t(language, "loadText")}</span>
      </button>
    </form>
  );
}
