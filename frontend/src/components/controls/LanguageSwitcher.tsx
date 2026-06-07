import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

export function LanguageSwitcher() {
  const language = useReaderStore((state) => state.language);
  const setLanguage = useReaderStore((state) => state.setLanguage);

  return (
    <div className="segmented-control" aria-label={t(language, "language")}>
      <button
        className={language === "en" ? "is-active" : ""}
        type="button"
        onClick={() => setLanguage("en")}
      >
        {t(language, "english")}
      </button>
      <button
        className={language === "zh" ? "is-active" : ""}
        type="button"
        onClick={() => setLanguage("zh")}
      >
        {t(language, "chinese")}
      </button>
    </div>
  );
}
