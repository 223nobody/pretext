import { ChangeEvent, useRef } from "react";
import { Eraser, MousePointer2 } from "lucide-react";

import { useReaderStore } from "../../store/readerStore";
import { t } from "../../lib/i18n";
import { IconButton } from "../ui/IconButton";

export function CursorStyleControls() {
  const inputRef = useRef<HTMLInputElement>(null);
  const customCursor = useReaderStore((state) => state.customCursor);
  const setCustomCursorFile = useReaderStore((state) => state.setCustomCursorFile);
  const language = useReaderStore((state) => state.language);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setCustomCursorFile(file);
    }
  };

  return (
    <div className="media-control-row">
      <button className="media-picker" type="button" onClick={() => inputRef.current?.click()}>
        <MousePointer2 size={16} />
        <span>{customCursor ? t(language, "customCursor") : t(language, "cursor")}</span>
      </button>
      {customCursor ? (
        <IconButton icon={Eraser} label={t(language, "removeCursor")} onClick={() => setCustomCursorFile(null)} />
      ) : null}
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/gif,image/apng,image/webp,video/webm"
        onChange={onChange}
      />
    </div>
  );
}
