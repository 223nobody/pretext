import { ChangeEvent, useRef } from "react";
import { Eraser, Film, RefreshCw, SlidersHorizontal } from "lucide-react";

import { useReaderStore } from "../../store/readerStore";
import { t } from "../../lib/i18n";
import { IconButton } from "../ui/IconButton";

export function BackgroundControls() {
  const inputRef = useRef<HTMLInputElement>(null);
  const backgroundVideo = useReaderStore((state) => state.backgroundVideo);
  const setBackgroundVideoFile = useReaderStore((state) => state.setBackgroundVideoFile);
  const setBackgroundSensitivity = useReaderStore((state) => state.setBackgroundSensitivity);
  const setBackgroundEdgePrecision = useReaderStore((state) => state.setBackgroundEdgePrecision);
  const setBackgroundOutlineWidth = useReaderStore((state) => state.setBackgroundOutlineWidth);
  const toggleBackgroundAutoMask = useReaderStore((state) => state.toggleBackgroundAutoMask);
  const toggleBackgroundInverted = useReaderStore((state) => state.toggleBackgroundInverted);
  const resampleBackground = useReaderStore((state) => state.resampleBackground);
  const language = useReaderStore((state) => state.language);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setBackgroundVideoFile(file);
    }
    event.target.value = "";
  };

  return (
    <div className="control-stack">
      <div className="media-control-row">
        <button className="media-picker" type="button" onClick={() => inputRef.current?.click()}>
          <Film size={16} />
          <span>{backgroundVideo.fileName ?? t(language, "video")}</span>
        </button>
        {backgroundVideo.url ? (
          <>
            <IconButton icon={RefreshCw} label={t(language, "resampleVideo")} onClick={resampleBackground} />
            <IconButton icon={Eraser} label={t(language, "removeVideo")} onClick={() => setBackgroundVideoFile(null)} />
          </>
        ) : null}
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          onChange={onChange}
        />
      </div>

      {backgroundVideo.url ? (
        <>
          <label className="control-row">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span className="visually-hidden">{t(language, "sensitivity")}</span>
            <input
              type="range"
              min="10"
              max="80"
              aria-label={t(language, "sensitivity")}
              value={backgroundVideo.sensitivity}
              onChange={(event) => setBackgroundSensitivity(Number(event.target.value))}
            />
            <output>{backgroundVideo.sensitivity}</output>
          </label>
          <label className="control-row">
            <span>{t(language, "edge")}</span>
            <input
              type="range"
              min="1"
              max="10"
              value={backgroundVideo.edgePrecision}
              onChange={(event) => setBackgroundEdgePrecision(Number(event.target.value))}
            />
            <output>{backgroundVideo.edgePrecision}</output>
          </label>
          <label className="control-row">
            <span>{t(language, "outline")}</span>
            <input
              type="range"
              min="0"
              max="20"
              value={backgroundVideo.outlineWidth}
              onChange={(event) => setBackgroundOutlineWidth(Number(event.target.value))}
            />
            <output>{backgroundVideo.outlineWidth}px</output>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={backgroundVideo.autoMask}
              onChange={toggleBackgroundAutoMask}
            />
            <span>{t(language, "autoMask")}</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={backgroundVideo.inverted}
              onChange={toggleBackgroundInverted}
            />
            <span>{t(language, "invertMask")}</span>
          </label>
        </>
      ) : null}
    </div>
  );
}
