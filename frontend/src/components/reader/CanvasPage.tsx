import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import type { PageLayoutResult } from "../../lib/pretext-engine";
import { createCanvasRenderer } from "../../renderer";
import type {
  BubbleState,
  CanvasRenderer,
  CursorState,
  TextLayerConfig,
} from "../../renderer";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

interface CanvasPageProps {
  pageLayout: PageLayoutResult;
  containerWidth: number;
  containerHeight: number;
  /** Shared background <video> element (decodes even while detached). */
  videoElement: HTMLVideoElement | null;
  /** Reports the immediate pointer position back to the layout owner. */
  onCursorMove?: (position: { x: number; y: number }) => void;
}

export function CanvasPage({
  pageLayout,
  containerWidth,
  containerHeight,
  videoElement,
  onCursorMove,
}: CanvasPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const rafRef = useRef(0);

  const columnCount = useReaderStore((s) => s.columnCount);
  const columnGap = useReaderStore((s) => s.columnGap);
  const fontSize = useReaderStore((s) => s.fontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const bubbleRadius = useReaderStore((s) => s.bubbleRadius);
  const currentPage = useReaderStore((s) => s.currentPage);
  const customCursor = useReaderStore((s) => s.customCursor);
  const language = useReaderStore((s) => s.language);
  const theme = useReaderStore((s) => s.theme);
  const hasVideo = useReaderStore((s) => Boolean(s.backgroundVideo.url));

  const dimensions = { w: containerWidth, h: containerHeight };
  const targetCursorRef = useRef({ x: containerWidth / 2, y: containerHeight / 2 });
  const currentCursorRef = useRef({ x: containerWidth / 2, y: containerHeight / 2 });
  const [customImg, setCustomImg] = useState<HTMLImageElement | null>(null);

  // Load custom cursor image
  useEffect(() => {
    if (!customCursor) {
      setCustomImg(null);
      return;
    }
    const img = new Image();
    img.src = customCursor;
    img.onload = () => setCustomImg(img);
    img.onerror = () => setCustomImg(null);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [customCursor]);

  // Create / resize renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container || dimensions.w <= 0 || dimensions.h <= 0) return;

    if (!rendererRef.current) {
      rendererRef.current = createCanvasRenderer({
        container,
        width: dimensions.w,
        height: dimensions.h,
        devicePixelRatio: window.devicePixelRatio || 1,
      });
    } else {
      rendererRef.current.resize(dimensions.w, dimensions.h);
    }

    rendererRef.current.renderBackgroundLayer(hasVideo ? videoElement : null);
  }, [dimensions, videoElement, hasVideo]);

  // Keep the shared video element attached in Canvas mode so browsers reliably
  // decode frames for drawImage() and for auto-mask analysis.
  useEffect(() => {
    const host = videoHostRef.current;
    if (!host || !videoElement) return;

    if (hasVideo) {
      if (videoElement.parentElement !== host) {
        host.appendChild(videoElement);
      }
    } else if (videoElement.parentElement === host) {
      host.removeChild(videoElement);
    }

    return () => {
      if (videoElement.parentElement === host) {
        host.removeChild(videoElement);
      }
    };
  }, [hasVideo, videoElement]);

  // Theme change → refresh cached colors and repaint all layers (§3.3.1).
  useEffect(() => {
    rendererRef.current?.updateColors();
  }, [theme]);

  // Memoized text layer config (avoids re-computation on every cursor move)
  const textConfig: TextLayerConfig = useMemo(() => {
    const pagePaddingX = Math.max(28, dimensions.w * 0.04);
    const pagePaddingY = Math.max(28, dimensions.h * 0.04);
    const totalGapWidth = (columnCount - 1) * columnGap;
    const columnWidth = Math.max(
      120,
      (dimensions.w - pagePaddingX * 2 - totalGapWidth) / columnCount,
    );

    return {
      pageLayout,
      pageIndex: currentPage,
      columnCount,
      columnWidth,
      columnGap,
      fontSize,
      lineHeight,
      fontFamily,
      pagePaddingX,
      pagePaddingY,
    };
  }, [
    pageLayout,
    currentPage,
    columnCount,
    columnGap,
    fontSize,
    lineHeight,
    fontFamily,
    dimensions,
  ]);

  // Render text when layout or config changes
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.renderTextLayer(textConfig);
  }, [textConfig]);

  // RAF loop for cursor effects (bubble lerp) + live video frames.
  // Dirty-flag driven: bubble/cursor layers are only repainted while the cursor
  // is still settling toward its target, so an idle reader costs ~0 draws/frame
  // (see NEXT_DEVELOPMENT_PLAN §4.1.2).
  useEffect(() => {
    // ~30fps ceiling for the (relatively expensive) video background repaint.
    let lastVideoDraw = 0;
    const VIDEO_INTERVAL = 1000 / 30;
    // Sub-pixel distance below which the cursor is considered "at rest".
    const SETTLE_EPSILON = 0.15;
    // Force one draw when the effect (re-)runs so a bubble-radius or custom-cursor
    // change repaints immediately even if the cursor is idle.
    let forceDraw = true;

    const animate = (timestamp: number) => {
      const current = currentCursorRef.current;
      const target = targetCursorRef.current;

      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const moving = Math.abs(dx) > SETTLE_EPSILON || Math.abs(dy) > SETTLE_EPSILON;

      // Always lerp toward target (smooth following).
      if (moving || forceDraw) {
        current.x += dx * 0.62;
        current.y += dy * 0.62;
      }

      const renderer = rendererRef.current;
      if (renderer) {
        // Redraw the background video frame (throttled, independent of cursor).
        if (hasVideo && videoElement && timestamp - lastVideoDraw >= VIDEO_INTERVAL) {
          lastVideoDraw = timestamp;
          renderer.renderBackgroundLayer(videoElement);
        }

        if (moving || forceDraw) {
          const bubble: BubbleState = { x: current.x, y: current.y, radius: bubbleRadius };
          const cursor: CursorState = { x: current.x, y: current.y, customImage: customImg };

          renderer.renderBubbleLayer(bubble);
          renderer.renderCursorLayer(cursor);
          forceDraw = false;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [bubbleRadius, customImg, hasVideo, videoElement]);

  // Handle pointer movement
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      targetCursorRef.current = { x, y };
      onCursorMove?.({ x, y });
    },
    [onCursorMove],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  // ARIA live region text for screen readers
  const ariaText = useMemo(() => {
    const page = pageLayout.pages[currentPage];
    if (!page) return "";
    const sample = page.columns[0]?.lines.slice(0, 3).map((l) => l.text).join(" ");
    return `${t(language, "pageControls")}: page ${currentPage + 1} of ${pageLayout.pageCount}. ${sample}`;
  }, [pageLayout, currentPage, language]);

  return (
    <div
      ref={containerRef}
      className="canvas-page"
      // Fill the outer PageCanvas. This must not reuse the `.page-canvas`
      // class: that class is a flex child in ReaderArea, and a nested element
      // with no explicit height clips the absolutely-positioned canvas layers
      // to 0px, leaving only the reader header visible after file import.
      // Hide the system cursor so the rendered cursor/bubble reads cleanly (§6.2.3).
      style={{ position: "absolute", inset: 0, outline: "none", cursor: "none" }}
      tabIndex={0}
      role="document"
      aria-label={t(language, "emptyTitle")}
      onPointerMove={onPointerMove}
    >
      <div
        ref={videoHostRef}
        aria-hidden="true"
        style={{
          // Keep the video element attached and decodable without letting it
          // visually compete with the Canvas-rendered frame. A fully 0-opacity
          // full-size media element can be deprioritized by some browsers, so
          // park it as a clipped 1px host instead.
          position: "absolute",
          left: -9999,
          top: 0,
          width: 1,
          height: 1,
          opacity: 0.01,
          pointerEvents: "none",
          zIndex: -1,
          overflow: "hidden",
        }}
      />
      {/* Screen-reader accessible text description */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {ariaText}
      </div>
    </div>
  );
}
