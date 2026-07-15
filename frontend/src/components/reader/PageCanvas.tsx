import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

import { useBackgroundVideo } from "../../hooks/useBackgroundVideo";
import { usePretext } from "../../hooks/usePretext";
import { structureArticleText } from "../../lib/articleStructure";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";
import { BackgroundLayer } from "./BackgroundLayer";
import { BubbleLayer } from "./BubbleLayer";
import { CanvasPage } from "./CanvasPage";
import { CursorLayer } from "./CursorLayer";
import { ProgressBar } from "./ProgressBar";
import { TextLayer } from "./TextLayer";

interface PageCanvasProps {
  text: string;
}

export function PageCanvas({ text }: PageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  const columnCount = useReaderStore((state) => state.columnCount);
  const columnGap = useReaderStore((state) => state.columnGap);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineHeight = useReaderStore((state) => state.lineHeight);
  const bubbleRadius = useReaderStore((state) => state.bubbleRadius);
  const backgroundVideo = useReaderStore((state) => state.backgroundVideo);
  const language = useReaderStore((state) => state.language);
  const currentPage = useReaderStore((state) => state.currentPage);
  const setCurrentPage = useReaderStore((state) => state.setCurrentPage);
  const setPageCount = useReaderStore((state) => state.setPageCount);
  const nextPage = useReaderStore((state) => state.nextPage);
  const previousPage = useReaderStore((state) => state.previousPage);
  const engineMode = useReaderStore((state) => state.engineMode);
  const fontFamily = useReaderStore((state) => state.fontFamily);

  const [visualCursor, setVisualCursor] = useState({ x: 50, y: 50 });
  const [layoutCursor, setLayoutCursor] = useState({ x: 50, y: 50 });
  const [progress, setProgress] = useState(0);
  const structuredArticle = useMemo(() => structureArticleText(text), [text]);
  const displayText = structuredArticle.text;
  const hasText = displayText.trim().length > 0;
  const videoMaskEnabled = hasText && Boolean(backgroundVideo.url);
  // A single background <video> element is shared by both render modes. It is
  // only loaded while there is readable content for the mask to affect.
  const videoRef = useBackgroundVideo(hasText);
  const layoutCursorRef = useRef(layoutCursor);
  const pendingLayoutCursorRef = useRef<{ x: number; y: number } | null>(null);
  const layoutCursorRafRef = useRef(0);
  const lastLayoutCursorCommitAtRef = useRef(0);

  // Observe container dimensions.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ w: width, h: height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Layout obstacles: background-video mask plus the live cursor bubble. The
  // cursor bubble is a page-level ellipse, so text genuinely reflows around a
  // circular hole instead of being pushed after layout.
  const pretextMask = useMemo(
    () => ({
      video: {
        enabled: videoMaskEnabled,
        x: backgroundVideo.maskX,
        y: backgroundVideo.maskY,
        size: backgroundVideo.maskSize,
        outlineWidth: backgroundVideo.outlineWidth,
        contour: backgroundVideo.contour,
      },
      cursor: {
        enabled: hasText && bubbleRadius > 0,
        x: layoutCursor.x,
        y: layoutCursor.y,
        size: bubbleRadius * 2 + Math.max(10, fontSize * 0.6),
      },
    }),
    [
      hasText,
      bubbleRadius,
      fontSize,
      layoutCursor.x,
      layoutCursor.y,
      videoMaskEnabled,
      backgroundVideo.maskX,
      backgroundVideo.maskY,
      backgroundVideo.maskSize,
      backgroundVideo.outlineWidth,
      backgroundVideo.contour,
    ],
  );

  // Pretext layout is the single source of truth for pagination in both modes.
  const {
    pageLayout,
    useFallback,
  } = usePretext(
    displayText,
    columnCount,
    columnGap,
    fontSize,
    lineHeight,
    containerSize.w,
    containerSize.h,
    fontFamily,
    pretextMask,
    currentPage,
    structuredArticle.blocks,
  );

  const useCanvasMode =
    engineMode === "canvas" && !useFallback && !!pageLayout && pageLayout.pageCount > 0;

  // Unified page count: always derived from Pretext when available.
  const pageCount = pageLayout && pageLayout.pageCount > 0 ? pageLayout.pageCount : 1;
  const safePage = Math.min(Math.max(0, currentPage), pageCount - 1);

  const currentPageLayout = useMemo(() => {
    return pageLayout?.pages[safePage] ?? null;
  }, [pageLayout, safePage]);

  // If Pretext produced no usable layout, degrade to raw paragraph text so the
  // reader still shows content on a single page.
  const fallbackLines = useMemo(() => {
    const page = pageLayout?.pages[safePage];
    if (page && page.columns.length > 0) {
      return [];
    }
    if (safePage === 0 && hasText) {
      return displayText
        .split(/\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line, index, all) => line || (index > 0 && index < all.length - 1))
        .map((line) => line || "\u00a0");
    }
    return [];
  }, [pageLayout, safePage, hasText, displayText]);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage, setCurrentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [displayText, setCurrentPage]);

  useEffect(() => {
    setPageCount(pageCount);
  }, [pageCount, setPageCount]);

  useEffect(() => {
    setProgress(pageCount <= 1 ? 100 : (safePage / (pageCount - 1)) * 100);
  }, [pageCount, safePage]);

  // Direction of the last page change, used to drive the slide/fade transition.
  const [flipDir, setFlipDir] = useState<"fwd" | "back" | null>(null);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goNext = useCallback(() => {
    if (safePage >= pageCount - 1) return;
    setFlipDir("fwd");
    nextPage();
  }, [safePage, pageCount, nextPage]);

  const goPrev = useCallback(() => {
    if (safePage <= 0) return;
    setFlipDir("back");
    previousPage();
  }, [safePage, previousPage]);

  useEffect(() => {
    if (!flipDir) return;
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => setFlipDir(null), 280);
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, [flipDir, safePage]);

  // Wheel / trackpad paging with an accumulator so small deltas do not skip pages.
  const wheelAccumRef = useRef(0);
  const wheelLockRef = useRef(false);

  const handleWheel = useCallback(
    (event: globalThis.WheelEvent) => {
      if (pageCount <= 1) return;
      event.preventDefault();
      if (wheelLockRef.current) return;

      wheelAccumRef.current += event.deltaY;
      const THRESHOLD = 120;

      if (wheelAccumRef.current >= THRESHOLD) {
        wheelAccumRef.current = 0;
        wheelLockRef.current = true;
        goNext();
      } else if (wheelAccumRef.current <= -THRESHOLD) {
        wheelAccumRef.current = 0;
        wheelLockRef.current = true;
        goPrev();
      }
    },
    [pageCount, goNext, goPrev],
  );

  // Release the wheel lock a beat after each page change.
  useEffect(() => {
    if (!wheelLockRef.current) return;
    const timer = setTimeout(() => {
      wheelLockRef.current = false;
      wheelAccumRef.current = 0;
    }, 320);
    return () => clearTimeout(timer);
  }, [safePage]);

  // Attach the wheel listener non-passively because preventDefault requires it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const flipClass = flipDir === "fwd" ? "flip-fwd" : flipDir === "back" ? "flip-back" : "";

  useEffect(() => {
    layoutCursorRef.current = layoutCursor;
  }, [layoutCursor]);

  useEffect(() => {
    return () => {
      if (layoutCursorRafRef.current) {
        cancelAnimationFrame(layoutCursorRafRef.current);
      }
    };
  }, []);

  const getPointerPercent = (element: HTMLElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(96, Math.max(4, x)),
      y: Math.min(92, Math.max(8, y)),
    };
  };

  const setVisualCursorIfChanged = useCallback((next: { x: number; y: number }) => {
    setVisualCursor((prev) => {
      if (Math.abs(prev.x - next.x) < 0.08 && Math.abs(prev.y - next.y) < 0.08) {
        return prev;
      }
      return next;
    });
  }, []);

  const scheduleLayoutCursor = useCallback((next: { x: number; y: number }) => {
    pendingLayoutCursorRef.current = next;
    if (layoutCursorRafRef.current) {
      return;
    }

    const flush = (timestamp: number) => {
      layoutCursorRafRef.current = 0;
      const pending = pendingLayoutCursorRef.current;
      if (!pending) return;

      const current = layoutCursorRef.current;
      const moved = Math.hypot(pending.x - current.x, pending.y - current.y);
      const elapsed = timestamp - lastLayoutCursorCommitAtRef.current;

      // Keep the visible bubble at pointer speed, but submit expensive text
      // reflow at a lower cadence and only after a meaningful movement.
      if (moved < 0.42) {
        return;
      }
      if (elapsed < 24) {
        layoutCursorRafRef.current = requestAnimationFrame(flush);
        return;
      }

      lastLayoutCursorCommitAtRef.current = timestamp;
      layoutCursorRef.current = pending;
      setLayoutCursor(pending);
    };

    layoutCursorRafRef.current = requestAnimationFrame(flush);
  }, []);

  const updateCursorFromCanvasPixels = useCallback(
    (position: { x: number; y: number }) => {
      if (containerSize.w <= 0 || containerSize.h <= 0) return;
      scheduleLayoutCursor({
        x: Math.min(96, Math.max(4, (position.x / containerSize.w) * 100)),
        y: Math.min(92, Math.max(8, (position.y / containerSize.h) * 100)),
      });
    },
    [containerSize.w, containerSize.h, scheduleLayoutCursor],
  );

  const updatePointerPosition = (event: PointerEvent<HTMLDivElement>) => {
    const next = getPointerPercent(event.currentTarget, event.clientX, event.clientY);
    setVisualCursorIfChanged(next);
    scheduleLayoutCursor(next);
  };

  const pageControls = hasText ? (
    <nav className="page-controls" aria-label={t(language, "pageControls")}>
      <button type="button" onClick={goPrev} disabled={safePage === 0}>
        {t(language, "prev")}
      </button>
      <span>
        {safePage + 1} / {pageCount}
      </span>
      <button type="button" onClick={goNext} disabled={safePage >= pageCount - 1}>
        {t(language, "next")}
      </button>
    </nav>
  ) : null;

  const pageArrows = hasText ? (
    <>
      <button
        className="page-arrow page-arrow-left"
        type="button"
        aria-label={t(language, "previousPage")}
        disabled={safePage === 0}
        onClick={goPrev}
        tabIndex={-1}
      />
      <button
        className="page-arrow page-arrow-right"
        type="button"
        aria-label={t(language, "nextPage")}
        disabled={safePage >= pageCount - 1}
        onClick={goNext}
        tabIndex={-1}
      />
    </>
  ) : null;

  // Canvas mode: the CanvasPage owns its own multi-layer <canvas> stack.
  if (useCanvasMode && pageLayout) {
    return (
      <>
        <div
          ref={containerRef}
          className={`page-canvas ${flipClass}`.trim()}
          style={{ position: "relative", width: "100%", height: "100%" }}
        >
          <ProgressBar value={hasText ? progress : 0} label={t(language, "readingProgress")} />
          <CanvasPage
            pageLayout={pageLayout}
            containerWidth={containerSize.w}
            containerHeight={containerSize.h}
            videoElement={videoMaskEnabled ? videoRef.current : null}
            onCursorMove={updateCursorFromCanvasPixels}
          />
          {pageArrows}
        </div>
        {pageControls}
      </>
    );
  }

  // CSS fallback mode still renders from the same Pretext page data.
  return (
    <>
      <div
        ref={containerRef}
        className={`page-canvas ${flipClass}`.trim()}
        data-bubble-active={hasText && bubbleRadius > 0 ? "true" : "false"}
        style={
          {
            cursor: hasText && bubbleRadius > 0 ? "none" : "auto",
            "--cursor-x": `${visualCursor.x}%`,
            "--cursor-y": `${visualCursor.y}%`,
            "--bubble-radius": `${bubbleRadius}px`,
          } as CSSProperties
        }
        onPointerMove={updatePointerPosition}
      >
        <ProgressBar value={hasText ? progress : 0} label={t(language, "readingProgress")} />
        {hasText ? <BackgroundLayer enabled={videoMaskEnabled} videoRef={videoRef} /> : null}
        {hasText ? (
          <TextLayer
            page={currentPageLayout}
            fallbackLines={fallbackLines}
            columnCount={columnCount}
            columnGap={columnGap}
            fontSize={fontSize}
            lineHeight={lineHeight}
            containerWidth={containerSize.w}
            containerHeight={containerSize.h}
            flipClass={flipClass}
          />
        ) : (
          <div className="empty-state">
            <h3>{t(language, "emptyTitle")}</h3>
            <p>{t(language, "emptyBody")}</p>
          </div>
        )}
        {hasText ? (
          <>
            <BubbleLayer />
            <CursorLayer />
          </>
        ) : null}
        {pageArrows}
      </div>
      {pageControls}
    </>
  );
}
