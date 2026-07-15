import { startTransition, useEffect, useRef, useState } from "react";

import {
  createCompositeMaskContour,
  createFrameSpanMaskContour,
  createPageEllipseMaskContour,
  layoutPagesInWorker,
  layoutPagesWithMask,
  type LayoutConfig,
  type PageLayoutResult,
} from "../lib/pretext-engine";
import type { ArticleBlock } from "../lib/articleStructure";
import type { VideoMaskResult } from "../lib/videoMaskAnalysis";

export interface UsePretextResult {
  pageLayout: PageLayoutResult | null;
  isLoading: boolean;
  error: string | null;
  useFallback: boolean;
}

/**
 * Optional layout obstacles. When either video or cursor mask is enabled, the
 * layout runs the mask-aware pipeline (`layoutPagesWithMask`) so text flows
 * around the obstacle, instead of being visually displaced after layout.
 * Positions are percentages of the page container (0-100); sizes are pixels.
 */
export interface PretextVideoMask {
  enabled: boolean;
  x: number;
  y: number;
  size: number;
  outlineWidth: number;
  contour: VideoMaskResult["contour"] | null;
}

export interface PretextCursorMask {
  enabled: boolean;
  x: number;
  y: number;
  size: number;
}

export interface PretextMask {
  video?: PretextVideoMask;
  cursor?: PretextCursorMask;
}

export function usePretext(
  text: string,
  columnCount: number,
  columnGap: number,
  fontSize: number,
  lineHeight: number,
  containerWidth: number,
  containerHeight: number,
  fontFamily: string,
  mask?: PretextMask,
  activePageIndex = 0,
  articleBlocks: ArticleBlock[] = [],
): UsePretextResult {
  const [pageLayout, setPageLayout] = useState<PageLayoutResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const layoutRunRef = useRef(0);

  const videoEnabled = mask?.video?.enabled ?? false;
  const videoX = mask?.video?.x ?? 0;
  const videoY = mask?.video?.y ?? 0;
  const videoSize = mask?.video?.size ?? 0;
  const videoOutlineWidth = mask?.video?.outlineWidth ?? 0;
  const videoContour = mask?.video?.contour ?? null;
  const cursorEnabled = mask?.cursor?.enabled ?? false;
  const cursorX = mask?.cursor?.x ?? 0;
  const cursorY = mask?.cursor?.y ?? 0;
  const cursorSize = mask?.cursor?.size ?? 0;
  const maskEnabled = videoEnabled || cursorEnabled;

  useEffect(() => {
    const runId = layoutRunRef.current + 1;
    layoutRunRef.current = runId;
    let cancelled = false;

    // Don't attempt layout without valid dimensions.
    if (!text.trim() || containerWidth <= 0 || containerHeight <= 0 || columnCount <= 0) {
      setPageLayout(null);
      setIsLoading(false);
      setUseFallback(false);
      return;
    }

    const pagePaddingX = Math.max(28, containerWidth * 0.04);
    const pagePaddingY = Math.max(28, containerHeight * 0.04);
    const totalGapWidth = (columnCount - 1) * columnGap;
    const columnWidth = Math.max(
      120,
      (containerWidth - pagePaddingX * 2 - totalGapWidth) / columnCount,
    );
    const columnHeight = containerHeight - pagePaddingY * 2;

    const config: LayoutConfig = {
      columnCount,
      columnWidth,
      columnHeight,
      columnGap,
      fontSize,
      lineHeight,
      fontFamily,
      pagePaddingX,
      pagePaddingY,
    };

    // Cursor obstacle layout should feel interactive. Keep it near one frame;
    // video contour analysis is heavier and can stay more aggressively debounced.
    const debounceMs = cursorEnabled ? 0 : videoEnabled ? 160 : 80;

    const runLayout = async () => {
      if (maskEnabled) {
        const contours = [];

        if (videoEnabled) {
          contours.push(
            videoContour
              ? createFrameSpanMaskContour(
                videoContour.spans,
                videoContour.frameWidth,
                videoContour.frameHeight,
                config,
                videoOutlineWidth,
                activePageIndex,
              )
              : createPageEllipseMaskContour(videoX, videoY, videoSize, config, activePageIndex),
          );
        }

        if (cursorEnabled) {
          contours.push(createPageEllipseMaskContour(cursorX, cursorY, cursorSize, config, activePageIndex));
        }

        return layoutPagesWithMask(text, config, createCompositeMaskContour(contours), articleBlocks);
      }

      return layoutPagesInWorker(text, config, articleBlocks);
    };

    // Debounce: 80ms is around the threshold of perceived continuity for normal
    // setting changes; cursor reflow uses a shorter delay above.
    const timer = setTimeout(async () => {
      if (cancelled || layoutRunRef.current !== runId) return;

      if (!cursorEnabled) {
        setIsLoading(true);
      }
      setError(null);

      // Retry up to 2 times before giving up and falling back to CSS.
      const MAX_ATTEMPTS = 3;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (cancelled || layoutRunRef.current !== runId) return;
        try {
          const { result, metrics, useFallback: fallback } = await runLayout();

          if (cancelled || layoutRunRef.current !== runId) return;

          if (import.meta.env.DEV) {
            console.log(
              `Pretext${maskEnabled ? " (mask)" : ""}: prepare ${metrics.prepareMs.toFixed(0)}ms, ` +
                `layout ${metrics.layoutMs.toFixed(0)}ms, ` +
                `partition ${metrics.partitionMs.toFixed(0)}ms, ` +
                `total ${metrics.totalMs.toFixed(0)}ms, ` +
                `${result.totalLines} lines, ${result.pageCount} pages` +
                (attempt > 1 ? ` (attempt ${attempt})` : ""),
            );
          }

          startTransition(() => {
            setPageLayout(result);
            setUseFallback(fallback);
          });
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (cancelled || layoutRunRef.current !== runId) return;
          console.warn(`Pretext layout attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err);
        }
      }

      if (lastError) {
        console.warn("Pretext layout failed after retries, using CSS fallback:", lastError);
        setError(lastError instanceof Error ? lastError.message : "Layout failed");
        setUseFallback(true);
      }

      if (!cursorEnabled && !cancelled && layoutRunRef.current === runId) {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    text,
    columnCount,
    columnGap,
    fontSize,
    lineHeight,
    containerWidth,
    containerHeight,
    fontFamily,
    maskEnabled,
    videoEnabled,
    videoX,
    videoY,
    videoSize,
    videoOutlineWidth,
    videoContour,
    cursorEnabled,
    cursorX,
    cursorY,
    cursorSize,
    activePageIndex,
    articleBlocks,
  ]);

  return { pageLayout, isLoading, error, useFallback };
}
