import { Columns3 } from "lucide-react";

import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

export function ColumnSlider() {
  const columnCount = useReaderStore((state) => state.columnCount);
  const language = useReaderStore((state) => state.language);
  const setColumnCount = useReaderStore((state) => state.setColumnCount);

  return (
    <label className="control-row">
      <Columns3 size={16} />
      <input
        type="range"
        min="1"
        max="4"
        step="1"
        value={columnCount}
        aria-label={t(language, "columns")}
        onChange={(event) => setColumnCount(Number(event.target.value))}
      />
      <output>{columnCount}</output>
    </label>
  );
}
