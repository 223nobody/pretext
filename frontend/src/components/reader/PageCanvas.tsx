import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";

import { usePretext } from "../../hooks/usePretext";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";
import { BackgroundLayer } from "./BackgroundLayer";
import { BubbleLayer } from "./BubbleLayer";
import { CursorLayer } from "./CursorLayer";
import { ProgressBar } from "./ProgressBar";
import { TextLayer } from "./TextLayer";

interface PageCanvasProps {
  text: string;
}

export function PageCanvas({ text }: PageCanvasProps) {
  const columnCount = useReaderStore((state) => state.columnCount);
  const columnGap = useReaderStore((state) => state.columnGap);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineHeight = useReaderStore((state) => state.lineHeight);
  const bubbleRadius = useReaderStore((state) => state.bubbleRadius);
  const backgroundVideo = useReaderStore((state) => state.backgroundVideo);
  const setBackgroundMask = useReaderStore((state) => state.setBackgroundMask);
  const language = useReaderStore((state) => state.language);
  const currentPage = useReaderStore((state) => state.currentPage);
  const paragraphsPerPage = useReaderStore((state) => state.paragraphsPerPage);
  const setCurrentPage = useReaderStore((state) => state.setCurrentPage);
  const setPageCount = useReaderStore((state) => state.setPageCount);
  const nextPage = useReaderStore((state) => state.nextPage);
  const previousPage = useReaderStore((state) => state.previousPage);
  const laidOutText = usePretext(text, columnCount, fontSize, lineHeight);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [isDraggingMask, setDraggingMask] = useState(false);
  const [progress, setProgress] = useState(0);
  const paragraphs = useMemo(
    () => laidOutText.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean),
    [laidOutText],
  );
  const pageCount = Math.max(1, Math.ceil(paragraphs.length / paragraphsPerPage));
  const safePage = Math.min(currentPage, pageCount - 1);
  const visibleParagraphs = paragraphs.slice(
    safePage * paragraphsPerPage,
    safePage * paragraphsPerPage + paragraphsPerPage,
  );
  const hasText = paragraphs.length > 0;

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage, setCurrentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [laidOutText, setCurrentPage]);

  useEffect(() => {
    setPageCount(pageCount);
  }, [pageCount, setPageCount]);

  useEffect(() => {
    setProgress(pageCount <= 1 ? 100 : (safePage / (pageCount - 1)) * 100);
  }, [pageCount, safePage]);

  const updatePointerPosition = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const next = {
      x: Math.min(96, Math.max(4, x)),
      y: Math.min(92, Math.max(8, y)),
    };
    setCursor(next);
    if (isDraggingMask) {
      setBackgroundMask(next);
    }
  };

  return (
    <div
      className="page-canvas"
      style={
        {
          "--cursor-x": `${cursor.x}%`,
          "--cursor-y": `${cursor.y}%`,
          "--bubble-radius": `${bubbleRadius}px`,
        } as CSSProperties
      }
      onPointerMove={updatePointerPosition}
      onPointerUp={() => setDraggingMask(false)}
      onPointerLeave={() => setDraggingMask(false)}
      onScroll={(event) => {
        const element = event.currentTarget;
        const maxScroll = element.scrollHeight - element.clientHeight;
        const pageProgress = pageCount <= 1 ? 100 : (safePage / (pageCount - 1)) * 100;
        const scrollProgress = maxScroll <= 0 ? 0 : (element.scrollTop / maxScroll) * (100 / pageCount);
        setProgress(Math.min(100, pageProgress + scrollProgress));
      }}
    >
      <ProgressBar value={hasText ? progress : 0} label={t(language, "readingProgress")} />
      <BackgroundLayer />
      {hasText ? (
        <TextLayer
          paragraphs={visibleParagraphs}
          columnCount={columnCount}
          columnGap={columnGap}
          fontSize={fontSize}
          lineHeight={lineHeight}
        />
      ) : (
        <div className="empty-state">
          <h3>{t(language, "emptyTitle")}</h3>
          <p>{t(language, "emptyBody")}</p>
        </div>
      )}
      {hasText ? (
        <nav className="page-controls" aria-label={t(language, "pageControls")}>
          <button type="button" onClick={previousPage} disabled={safePage === 0}>
            {t(language, "prev")}
          </button>
          <span>
            {safePage + 1} / {pageCount}
          </span>
          <button type="button" onClick={nextPage} disabled={safePage >= pageCount - 1}>
            {t(language, "next")}
          </button>
        </nav>
      ) : null}
      {backgroundVideo.url ? (
        <button
          className="video-mask-handle"
          type="button"
          title={t(language, "dragVideoTextWrapMask")}
          aria-label={t(language, "dragVideoTextWrapMask")}
          style={
            {
              "--mask-x": `${backgroundVideo.maskX}%`,
              "--mask-y": `${backgroundVideo.maskY}%`,
              "--mask-size": `${backgroundVideo.maskSize}px`,
            } as CSSProperties
          }
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDraggingMask(true);
          }}
        />
      ) : null}
      <BubbleLayer />
      <CursorLayer />
    </div>
  );
}
