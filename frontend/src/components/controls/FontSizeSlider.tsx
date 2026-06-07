import { CaseSensitive } from "lucide-react";

import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

export function FontSizeSlider() {
  const fontSize = useReaderStore((state) => state.fontSize);
  const language = useReaderStore((state) => state.language);
  const setFontSize = useReaderStore((state) => state.setFontSize);

  return (
    <label className="control-row">
      <CaseSensitive size={16} />
      <input
        type="range"
        min="12"
        max="28"
        value={fontSize}
        aria-label={t(language, "fontSize")}
        onChange={(event) => setFontSize(Number(event.target.value))}
      />
      <output>{fontSize}px</output>
    </label>
  );
}
