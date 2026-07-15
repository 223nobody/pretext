import { BookOpenText, PanelLeftClose } from "lucide-react";

import { BackgroundControls } from "../controls/BackgroundControls";
import { SampleLoader } from "../content/SampleLoader";
import { SmartInput } from "../content/SmartInput";
import { ColumnSlider } from "../controls/ColumnSlider";
import { CursorStyleControls } from "../controls/CursorStyleControls";
import { FontSizeSlider } from "../controls/FontSizeSlider";
import { FullscreenButton } from "../controls/FullscreenButton";
import { LanguageSwitcher } from "../controls/LanguageSwitcher";
import { ThemeSwitcher } from "../controls/ThemeSwitcher";
import { IconButton } from "../ui/IconButton";
import { FileUpload } from "../upload/FileUpload";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

export function Sidebar() {
  const lineHeight = useReaderStore((state) => state.lineHeight);
  const setLineHeight = useReaderStore((state) => state.setLineHeight);
  const columnGap = useReaderStore((state) => state.columnGap);
  const setColumnGap = useReaderStore((state) => state.setColumnGap);
  const bubbleRadius = useReaderStore((state) => state.bubbleRadius);
  const setBubbleRadius = useReaderStore((state) => state.setBubbleRadius);
  const language = useReaderStore((state) => state.language);
  const toggleSidebar = useReaderStore((state) => state.toggleSidebar);

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">
          <BookOpenText size={22} />
        </div>
        <div className="brand-copy">
          <h1>Pretext Reader</h1>
          <p>{t(language, "phase")}</p>
        </div>
        <IconButton
          className="sidebar-header-action"
          icon={PanelLeftClose}
          label={t(language, "hidePanel")}
          onClick={toggleSidebar}
        />
      </div>

      <section className="panel-section">
        <div className="section-title">{t(language, "source")}</div>
        <SmartInput />
        <FileUpload />
        <SampleLoader />
      </section>

      <section className="panel-section">
        <div className="section-title">{t(language, "layout")}</div>
        <ColumnSlider />
        <label className="control-row">
          <span>{t(language, "columnGap")}</span>
          <input
            type="range"
            min="16"
            max="80"
            step="2"
            value={columnGap}
            onChange={(event) => setColumnGap(Number(event.target.value))}
          />
          <output>{columnGap}px</output>
        </label>
        <FontSizeSlider />
        <label className="control-row">
          <span>{t(language, "line")}</span>
          <input
            type="range"
            min="1.2"
            max="2.2"
            step="0.05"
            value={lineHeight}
            onChange={(event) => setLineHeight(Number(event.target.value))}
          />
          <output>{lineHeight.toFixed(2)}</output>
        </label>
        <label className="control-row">
          <span>{t(language, "bubble")}</span>
          <input
            type="range"
            min="0"
            max="150"
            value={bubbleRadius}
            onChange={(event) => setBubbleRadius(Number(event.target.value))}
          />
          <output>{bubbleRadius}px</output>
        </label>
      </section>

      <section className="panel-section">
        <div className="section-title">{t(language, "media")}</div>
        <BackgroundControls />
        <CursorStyleControls />
      </section>

      <section className="panel-section">
        <div className="section-title">{t(language, "theme")}</div>
        <ThemeSwitcher />
        <LanguageSwitcher />
      </section>

      <div className="sidebar-footer">
        <FullscreenButton />
      </div>
    </aside>
  );
}
