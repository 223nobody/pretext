import type {
  LayoutCursor,
  LayoutLine,
  LayoutLineRange,
  LayoutLinesResult,
  PreparedTextWithSegments,
} from "@chenglou/pretext";
import {
  assignArticleLineRoles,
  roleForTextOffset,
  type ArticleBlock,
  type ArticleLineRole,
} from "./articleStructure";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LayoutConfig {
  columnCount: number;
  columnWidth: number;
  columnHeight: number;
  columnGap: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  pagePaddingX: number;
  pagePaddingY: number;
}

export interface FlowLine extends LayoutLine {
  /** Horizontal offset inside the column where this line should be drawn. */
  xOffset: number;
  /** Vertical offset inside the column where this line should be drawn. */
  yOffset: number;
  /** Width that was available to Pretext for this line. */
  availableWidth: number;
  /** Semantic role inferred from the article structure for visual styling. */
  role?: ArticleLineRole;
}

export interface ColumnLayout {
  columnIndex: number;
  lines: FlowLine[];
  totalHeight: number;
  overflowed: boolean;
}

export interface PageLayout {
  pageIndex: number;
  columns: ColumnLayout[];
}

export interface PageLayoutResult {
  pages: PageLayout[];
  pageCount: number;
  totalChars: number;
  totalLines: number;
}

export interface EngineMetrics {
  prepareMs: number;
  layoutMs: number;
  partitionMs: number;
  totalMs: number;
}

export interface ObstacleSpan {
  left: number;
  right: number;
}

export interface AvailableSpan {
  startX: number;
  width: number;
}

export interface ObstacleQuery {
  columnIndex: number;
  lineTop: number;
  lineCenterY: number;
  lineHeight: number;
  columnWidth: number;
  columnHeight: number;
}

// ---------------------------------------------------------------------------
// Font helpers
// ---------------------------------------------------------------------------

export function buildFontString(fontSize: number, fontFamily: string): string {
  return `${fontSize}px ${fontFamily}`;
}

// ---------------------------------------------------------------------------
// CJK detection (fast sample-based)
// ---------------------------------------------------------------------------

const CJK_RE = /\p{Script=Han}/u;

function containsCJK(text: string): boolean {
  return CJK_RE.test(text.slice(0, 2000));
}

// ---------------------------------------------------------------------------
// Pretext preparation
// ---------------------------------------------------------------------------

interface PrepareResult {
  prepared: PreparedTextWithSegments;
  metrics: { prepareMs: number };
}

const PREPARE_CACHE_LIMIT = 4;
const prepareCache = new Map<string, PreparedTextWithSegments>();

async function prepareText(
  text: string,
  config: LayoutConfig,
): Promise<PrepareResult | null> {
  const fontString = buildFontString(config.fontSize, config.fontFamily);
  const cacheKey = `${fontString}\u0000${text}`;
  const cached = prepareCache.get(cacheKey);
  if (cached) {
    return { prepared: cached, metrics: { prepareMs: 0 } };
  }

  try {
    const {
      prepareWithSegments,
    } = await import("@chenglou/pretext");

    const t0 = performance.now();
    const prepared = prepareWithSegments(text, fontString, {
      whiteSpace: "pre-wrap",
      wordBreak: "normal",
    });
    const prepareMs = performance.now() - t0;

    if (prepareCache.size >= PREPARE_CACHE_LIMIT) {
      const oldestKey = prepareCache.keys().next().value;
      if (oldestKey !== undefined) {
        prepareCache.delete(oldestKey);
      }
    }
    prepareCache.set(cacheKey, prepared);

    return { prepared, metrics: { prepareMs } };
  } catch (err) {
    console.warn("Pretext engine unavailable, falling back to CSS renderer:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Line layout
// ---------------------------------------------------------------------------

function layoutAllLines(
  prepared: PreparedTextWithSegments,
  config: LayoutConfig,
  // layout functions must be passed in (imported at call site since this is ESM)
  layoutFns: {
    layoutWithLines: (
      p: PreparedTextWithSegments,
      maxW: number,
      lineH: number,
    ) => LayoutLinesResult;
  },
): { lines: LayoutLine[]; metrics: { layoutMs: number } } {
  const lineHeightPx = config.fontSize * config.lineHeight;

  const t0 = performance.now();
  const result = layoutFns.layoutWithLines(prepared, config.columnWidth, lineHeightPx);
  const layoutMs = performance.now() - t0;

  return { lines: result.lines, metrics: { layoutMs } };
}

// ---------------------------------------------------------------------------
// Column partitioning
// ---------------------------------------------------------------------------

function partitionIntoColumns(
  lines: LayoutLine[],
  config: LayoutConfig,
  prepared?: PreparedTextWithSegments,
  articleBlocks: ArticleBlock[] = [],
): ColumnLayout[] {
  const lineHeightPx = config.fontSize * config.lineHeight;
  const columns: ColumnLayout[] = [];
  let columnIndex = 0;

  for (let i = 0; i < lines.length; ) {
    const columnLines: FlowLine[] = [];
    let accumulatedHeight = 0;

    while (i < lines.length) {
      const nextHeight = accumulatedHeight + lineHeightPx;
      if (
        columnLines.length > 0 &&
        nextHeight > config.columnHeight
      ) {
        break;
      }
      columnLines.push({
        ...lines[i],
        xOffset: 0,
        yOffset: accumulatedHeight,
        availableWidth: config.columnWidth,
      });
      accumulatedHeight = nextHeight;
      i++;
    }

    columns.push({
      columnIndex,
      lines: columnLines,
      totalHeight: accumulatedHeight,
      overflowed:
        columnLines.length === 1 &&
        lineHeightPx > config.columnHeight,
    });

    columnIndex++;
  }

  return annotateArticleRoles(columns, prepared, articleBlocks);
}

function segmentStartOffsets(prepared: PreparedTextWithSegments): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const segment of prepared.segments) {
    offsets.push(cursor);
    cursor += segment.length;
  }
  return offsets;
}

function lineTextOffset(line: LayoutLine, segmentOffsets: number[]): number {
  const segmentStart = segmentOffsets[line.start.segmentIndex] ?? 0;
  return segmentStart + line.start.graphemeIndex;
}

function annotateArticleRoles(
  columns: ColumnLayout[],
  prepared?: PreparedTextWithSegments,
  articleBlocks: ArticleBlock[] = [],
): ColumnLayout[] {
  if (prepared && articleBlocks.length > 0) {
    const offsets = segmentStartOffsets(prepared);
    return columns.map((column) => ({
      ...column,
      lines: column.lines.map((line) => ({
        ...line,
        role: line.text.trim()
          ? roleForTextOffset(articleBlocks, lineTextOffset(line, offsets))
          : "body",
      })),
    }));
  }

  const flowLines = columns.flatMap((column) => column.lines);
  const roles = assignArticleLineRoles(flowLines);
  let cursor = 0;

  return columns.map((column) => ({
    ...column,
    lines: column.lines.map((line) => ({
      ...line,
      role: roles[cursor++] ?? "body",
    })),
  }));
}

// ---------------------------------------------------------------------------
// Page partitioning
// ---------------------------------------------------------------------------

function partitionIntoPages(
  columns: ColumnLayout[],
  config: LayoutConfig,
): PageLayout[] {
  const pages: PageLayout[] = [];

  for (let i = 0; i < columns.length; i += config.columnCount) {
    const pageColumns = columns.slice(i, i + config.columnCount).map((column, localIndex) => ({
      ...column,
      // `columnIndex` is page-local for renderers. Without this remap, page 2+
      // columns render off-canvas because their global index keeps increasing.
      columnIndex: localIndex,
    }));

    pages.push({
      pageIndex: pages.length,
      columns: pageColumns,
    });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Top-level layout function
// ---------------------------------------------------------------------------

export async function layoutPages(
  text: string,
  config: LayoutConfig,
  articleBlocks: ArticleBlock[] = [],
): Promise<{ result: PageLayoutResult; metrics: EngineMetrics; useFallback: boolean }> {
  // Edge cases: empty or whitespace-only text
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      result: {
        pages: [],
        pageCount: 0,
        totalChars: text.length,
        totalLines: 0,
      },
      metrics: { prepareMs: 0, layoutMs: 0, partitionMs: 0, totalMs: 0 },
      useFallback: false,
    };
  }

  const prepareResult = await prepareText(text, config);
  if (!prepareResult) {
    return {
      result: {
        pages: [],
        pageCount: 0,
        totalChars: text.length,
        totalLines: 0,
      },
      metrics: { prepareMs: 0, layoutMs: 0, partitionMs: 0, totalMs: 0 },
      useFallback: true,
    };
  }

  const { prepared, metrics: prepMetrics } = prepareResult;

  // Import layout functions (same module as prepare)
  const { layoutWithLines } = await import("@chenglou/pretext");

  const { lines, metrics: layoutMetrics } = layoutAllLines(prepared, config, {
    layoutWithLines,
  });

  const t0 = performance.now();
  const columns = partitionIntoColumns(lines, config, prepared, articleBlocks);
  const pages = partitionIntoPages(columns, config);
  const partitionMs = performance.now() - t0;

  const pageCount = pages.length || 1;

  return {
    result: {
      pages: pages.length > 0
        ? pages
        : [{ pageIndex: 0, columns: [] }],
      pageCount,
      totalChars: text.length,
      totalLines: lines.length,
    },
    metrics: {
      prepareMs: prepMetrics.prepareMs,
      layoutMs: layoutMetrics.layoutMs,
      partitionMs,
      totalMs: prepMetrics.prepareMs + layoutMetrics.layoutMs + partitionMs,
    },
    useFallback: false,
  };
}

// ---------------------------------------------------------------------------
// Worker-based layout (off-main-thread)
// ---------------------------------------------------------------------------

let _workerInstance: Worker | null = null;

function getWorker(): Worker | null {
  if (_workerInstance) return _workerInstance;

  try {
    _workerInstance = new Worker(
      new URL("../workers/pretext.worker.ts", import.meta.url),
      { type: "module" },
    );
    return _workerInstance;
  } catch {
    console.warn("Pretext Web Worker unavailable, using main-thread layout");
    return null;
  }
}

interface WorkerLayoutResponse {
  type: "result";
  result: PageLayoutResult;
  metrics: EngineMetrics;
}

interface WorkerErrorResponse {
  type: "error";
  message: string;
}

/**
 * Runs the full layout pipeline in a Web Worker to avoid blocking the main thread.
 * Falls back to main-thread `layoutPages()` if the worker cannot be created.
 */
export async function layoutPagesInWorker(
  text: string,
  config: LayoutConfig,
  articleBlocks: ArticleBlock[] = [],
): Promise<{ result: PageLayoutResult; metrics: EngineMetrics; useFallback: boolean }> {
  const worker = getWorker();

  if (!worker) {
    // Fallback to main-thread layout
    return layoutPages(text, config);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("Pretext worker timed out, using CSS fallback");
      resolve({
        result: { pages: [], pageCount: 0, totalChars: text.length, totalLines: 0 },
        metrics: { prepareMs: 0, layoutMs: 0, partitionMs: 0, totalMs: 0 },
        useFallback: true,
      });
    }, 5_000); // 5-second timeout for worker (see NEXT_DEVELOPMENT_PLAN §10.3)

    const onMessage = (event: MessageEvent<WorkerLayoutResponse | WorkerErrorResponse>) => {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);

      const { data } = event;

      if (data.type === "result") {
        resolve({ result: data.result, metrics: data.metrics, useFallback: false });
      } else {
        console.warn("Pretext worker error:", data.message);
        resolve({
          result: { pages: [], pageCount: 0, totalChars: text.length, totalLines: 0 },
          metrics: { prepareMs: 0, layoutMs: 0, partitionMs: 0, totalMs: 0 },
          useFallback: true,
        });
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ type: "layout", text, config, articleBlocks });
  });
}

// ---------------------------------------------------------------------------
// Variable-width mask-aware layout (for Step 5 — video text wrapping)
// ---------------------------------------------------------------------------

export interface MaskContour {
  getObstacleSpans?(query: ObstacleQuery): ObstacleSpan[];
  getMaskedSpan(
    lineY: number,
    columnHeight: number,
  ): ObstacleSpan | null;
}

function clampSpanToColumn(span: ObstacleSpan, columnWidth: number): ObstacleSpan | null {
  const left = Math.max(0, Math.min(columnWidth, span.left));
  const right = Math.max(0, Math.min(columnWidth, span.right));
  return right > left ? { left, right } : null;
}

function mergeObstacleSpans(spans: ObstacleSpan[], columnWidth: number): ObstacleSpan[] {
  const blocked = spans
    .map((span) => clampSpanToColumn(span, columnWidth))
    .filter((span): span is ObstacleSpan => span !== null)
    .sort((a, b) => a.left - b.left);

  const merged: ObstacleSpan[] = [];
  for (const span of blocked) {
    const prev = merged[merged.length - 1];
    if (prev && span.left <= prev.right) {
      prev.right = Math.max(prev.right, span.right);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

function outlineBands(left: number, right: number, outlinePx: number): ObstacleSpan[] {
  if (right <= left) return [];
  if (outlinePx > 0 && right - left > outlinePx * 2) {
    return [
      { left, right: left + outlinePx },
      { left: right - outlinePx, right },
    ];
  }
  return [{ left, right }];
}

export function availableSpansFromObstacles(
  columnWidth: number,
  obstacleSpans: ObstacleSpan[],
): AvailableSpan[] {
  const blocked = obstacleSpans
    .map((span) => clampSpanToColumn(span, columnWidth))
    .filter((span): span is ObstacleSpan => span !== null)
    .sort((a, b) => a.left - b.left);

  if (blocked.length === 0) {
    return [{ startX: 0, width: columnWidth }];
  }

  const merged: ObstacleSpan[] = [];
  for (const span of blocked) {
    const prev = merged[merged.length - 1];
    if (prev && span.left <= prev.right) {
      prev.right = Math.max(prev.right, span.right);
    } else {
      merged.push({ ...span });
    }
  }

  const available: AvailableSpan[] = [];
  let cursorX = 0;
  for (const span of merged) {
    if (span.left - cursorX > 2) {
      available.push({ startX: cursorX, width: span.left - cursorX });
    }
    cursorX = Math.max(cursorX, span.right);
  }
  if (columnWidth - cursorX > 2) {
    available.push({ startX: cursorX, width: columnWidth - cursorX });
  }

  return available.length > 0 ? available : [{ startX: 0, width: Math.max(1, columnWidth) }];
}

export function pickBestAvailableSpan(spans: AvailableSpan[]): AvailableSpan {
  return spans.reduce((best, span) => {
    if (span.width > best.width) return span;
    if (span.width === best.width && span.startX < best.startX) return span;
    return best;
  }, spans[0] ?? { startX: 0, width: 1 });
}

export function createEllipseMaskContour(
  centerXPercent: number,
  centerYPercent: number,
  sizePx: number,
  columnWidth: number,
  columnHeight: number,
): MaskContour {
  const cx = (centerXPercent / 100) * columnWidth;
  const cy = (centerYPercent / 100) * columnHeight;
  const rx = sizePx / 2;
  const ry = sizePx / 2;

  const spanAt = (lineY: number): ObstacleSpan | null => {
    const dy = lineY - cy;
    if (Math.abs(dy) > ry) return null;

    const chordHalfWidth = rx * Math.sqrt(1 - (dy * dy) / (ry * ry));
    return {
      left: Math.max(0, cx - chordHalfWidth),
      right: Math.min(columnWidth, cx + chordHalfWidth),
    };
  };

  return {
    getObstacleSpans(query: ObstacleQuery): ObstacleSpan[] {
      const span = spanAt(query.lineCenterY);
      return span ? [span] : [];
    },
    getMaskedSpan(lineY: number, _colHeight: number): { left: number; right: number } | null {
      return spanAt(lineY);
    },
  };
}

export function createPageEllipseMaskContour(
  centerXPercent: number,
  centerYPercent: number,
  sizePx: number,
  config: LayoutConfig,
  activePageIndex?: number,
): MaskContour {
  const contentWidth =
    config.columnCount * config.columnWidth + (config.columnCount - 1) * config.columnGap;
  const pageWidth = config.pagePaddingX * 2 + contentWidth;
  const pageHeight = config.pagePaddingY * 2 + config.columnHeight;
  const cx = (centerXPercent / 100) * pageWidth;
  const cy = (centerYPercent / 100) * pageHeight;
  const rx = sizePx / 2;
  const ry = sizePx / 2;

  return {
    getObstacleSpans(query: ObstacleQuery): ObstacleSpan[] {
      if (
        activePageIndex !== undefined &&
        Math.floor(query.columnIndex / config.columnCount) !== activePageIndex
      ) {
        return [];
      }

      const absoluteY = config.pagePaddingY + query.lineCenterY;
      const dy = absoluteY - cy;
      if (Math.abs(dy) > ry) return [];

      const chordHalfWidth = rx * Math.sqrt(1 - (dy * dy) / (ry * ry));
      const absoluteLeft = cx - chordHalfWidth;
      const absoluteRight = cx + chordHalfWidth;
      const localColumnIndex = query.columnIndex % config.columnCount;
      const columnLeft =
        config.pagePaddingX + localColumnIndex * (config.columnWidth + config.columnGap);
      const clamped = clampSpanToColumn(
        { left: absoluteLeft - columnLeft, right: absoluteRight - columnLeft },
        config.columnWidth,
      );
      return clamped ? [clamped] : [];
    },
    getMaskedSpan(lineY: number): ObstacleSpan | null {
      return createEllipseMaskContour(
        centerXPercent,
        centerYPercent,
        sizePx,
        config.columnWidth,
        config.columnHeight,
      ).getMaskedSpan(lineY, config.columnHeight);
    },
  };
}

/**
 * Builds a contour from per-row silhouette spans (as produced by
 * `videoContourAnalysis.analyzeContour`). Spans are given in the analysis
 * frame's pixel grid (`frameWidth` × `frameHeight`) and mapped into the
 * column's coordinate space. This lets text wrap the subject's actual outline
 * rather than a fixed ellipse (see NEXT_DEVELOPMENT_PLAN §5.2.1).
 *
 * When `outlineOnly` is set, the masked span covers only the outer silhouette
 * edges (a band of `outlinePx`), so text may sit inside the subject but wraps
 * its outer contour — Textdance's "轮廓宽度 > 0" behaviour (§5.3.4).
 */
export function createSpanMaskContour(
  spans: { row: number; left: number; right: number }[],
  frameWidth: number,
  frameHeight: number,
  columnWidth: number,
  columnHeight: number,
  outlinePx = 0,
): MaskContour {
  // Index spans by row for O(1) vertical lookup after mapping.
  const scaleX = columnWidth / Math.max(1, frameWidth);
  const scaleY = columnHeight / Math.max(1, frameHeight);

  // Precompute mapped spans keyed by their column-space row band.
  const mapped = spans.map((s) => ({
    top: s.row * scaleY,
    bottom: (s.row + 1) * scaleY,
    left: s.left * scaleX,
    right: (s.right + 1) * scaleX,
  }));

  const spansAt = (lineY: number): ObstacleSpan[] => {
    const out: ObstacleSpan[] = [];
    for (const m of mapped) {
      if (lineY < m.top || lineY >= m.bottom) continue;
      for (const band of outlineBands(m.left, m.right, outlinePx)) {
        const clamped = clampSpanToColumn(band, columnWidth);
        if (clamped) out.push(clamped);
      }
    }
    return out;
  };

  return {
    getObstacleSpans(query: ObstacleQuery): ObstacleSpan[] {
      return spansAt(query.lineCenterY);
    },
    getMaskedSpan(lineY: number): { left: number; right: number } | null {
      return spansAt(lineY)[0] ?? null;
    },
  };
}

export function createFrameSpanMaskContour(
  spans: { row: number; left: number; right: number }[],
  frameWidth: number,
  frameHeight: number,
  config: LayoutConfig,
  outlinePx = 0,
  activePageIndex?: number,
): MaskContour {
  const rows = new Map<number, { row: number; left: number; right: number }[]>();
  for (const span of spans) {
    const bucket = rows.get(span.row) ?? [];
    bucket.push(span);
    rows.set(span.row, bucket);
  }

  const contentWidth =
    config.columnCount * config.columnWidth + (config.columnCount - 1) * config.columnGap;
  const pageWidth = config.pagePaddingX * 2 + contentWidth;
  const pageHeight = config.pagePaddingY * 2 + config.columnHeight;
  const videoScale = Math.min(
    pageWidth / Math.max(1, frameWidth),
    pageHeight / Math.max(1, frameHeight),
  );
  const displayWidth = frameWidth * videoScale;
  const displayHeight = frameHeight * videoScale;
  const displayLeft = (pageWidth - displayWidth) / 2;
  const displayTop = (pageHeight - displayHeight) / 2;
  const readablePaddingPx = Math.max(10, config.fontSize * 0.8);

  return {
    getObstacleSpans(query: ObstacleQuery): ObstacleSpan[] {
      if (
        activePageIndex !== undefined &&
        Math.floor(query.columnIndex / config.columnCount) !== activePageIndex
      ) {
        return [];
      }

      const absoluteTop = config.pagePaddingY + query.lineTop;
      const absoluteBottom = absoluteTop + query.lineHeight;
      const intersectTop = Math.max(absoluteTop, displayTop);
      const intersectBottom = Math.min(absoluteBottom, displayTop + displayHeight);
      if (intersectBottom <= intersectTop) {
        return [];
      }

      const sourceTop = Math.max(
        0,
        Math.floor(((intersectTop - displayTop) / Math.max(1, displayHeight)) * frameHeight),
      );
      const sourceBottom = Math.min(
        frameHeight - 1,
        Math.ceil(((intersectBottom - displayTop) / Math.max(1, displayHeight)) * frameHeight),
      );
      const localColumnIndex = query.columnIndex % config.columnCount;
      const columnLeft =
        config.pagePaddingX + localColumnIndex * (config.columnWidth + config.columnGap);
      const out: ObstacleSpan[] = [];

      for (let row = sourceTop; row <= sourceBottom; row++) {
        const rowSpans = rows.get(row);
        if (!rowSpans) continue;
        for (const span of rowSpans) {
          const absoluteLeft =
            displayLeft + (span.left / Math.max(1, frameWidth)) * displayWidth - readablePaddingPx;
          const absoluteRight =
            displayLeft + ((span.right + 1) / Math.max(1, frameWidth)) * displayWidth + readablePaddingPx;
          for (const band of outlineBands(absoluteLeft, absoluteRight, outlinePx)) {
            const clamped = clampSpanToColumn(
              { left: band.left - columnLeft, right: band.right - columnLeft },
              config.columnWidth,
            );
            if (clamped) out.push(clamped);
          }
        }
      }

      return mergeObstacleSpans(out, config.columnWidth);
    },
    getMaskedSpan(): ObstacleSpan | null {
      return null;
    },
  };
}

export function createCompositeMaskContour(contours: MaskContour[]): MaskContour {
  return {
    getObstacleSpans(query: ObstacleQuery): ObstacleSpan[] {
      return contours.flatMap((contour) => (
        contour.getObstacleSpans
          ? contour.getObstacleSpans(query)
          : [contour.getMaskedSpan(query.lineCenterY, query.columnHeight)].filter(
            (span): span is ObstacleSpan => span !== null,
          )
      ));
    },
    getMaskedSpan(lineY: number, columnHeight: number): ObstacleSpan | null {
      for (const contour of contours) {
        const span = contour.getMaskedSpan(lineY, columnHeight);
        if (span) return span;
      }
      return null;
    },
  };
}

export async function layoutPagesWithMask(
  text: string,
  config: LayoutConfig,
  maskContour: MaskContour,
  articleBlocks: ArticleBlock[] = [],
): Promise<{ result: PageLayoutResult; metrics: EngineMetrics; useFallback: boolean }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      result: { pages: [], pageCount: 0, totalChars: text.length, totalLines: 0 },
      metrics: { prepareMs: 0, layoutMs: 0, partitionMs: 0, totalMs: 0 },
      useFallback: false,
    };
  }

  const prepareResult = await prepareText(text, config);
  if (!prepareResult) {
    return {
      result: { pages: [], pageCount: 0, totalChars: text.length, totalLines: 0 },
      metrics: { prepareMs: 0, layoutMs: 0, partitionMs: 0, totalMs: 0 },
      useFallback: true,
    };
  }

  const { prepared, metrics: prepMetrics } = prepareResult;
  const lineHeightPx = config.fontSize * config.lineHeight;

  const t0 = performance.now();

  const {
    layoutNextLineRange,
    materializeLineRange,
  } = await import("@chenglou/pretext");

  const columns: ColumnLayout[] = [];
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  let done = false;
  let columnIndex = 0;
  let emptyColumnsInRow = 0;
  const maxColumns = Math.max(
    config.columnCount,
    Math.ceil(text.length / 2) + config.columnCount * 4,
  );

  while (!done && columnIndex < maxColumns) {
    const columnLines: FlowLine[] = [];
    let lineY = 0;

    while (true) {
      if (columnLines.length > 0 && lineY + lineHeightPx > config.columnHeight) {
        break;
      }

      const obstacleSpans = maskContour.getObstacleSpans
        ? maskContour.getObstacleSpans({
          columnIndex,
          lineTop: lineY,
          lineCenterY: lineY + lineHeightPx / 2,
          lineHeight: lineHeightPx,
          columnWidth: config.columnWidth,
          columnHeight: config.columnHeight,
        })
        : [
          maskContour.getMaskedSpan(lineY + lineHeightPx / 2, config.columnHeight),
        ].filter((span): span is ObstacleSpan => span !== null);
      const availableSpans = availableSpansFromObstacles(config.columnWidth, obstacleSpans);
      const usableSpans = availableSpans.filter((span) => span.width >= Math.max(24, config.fontSize * 2));
      const spansForRow = usableSpans.length > 0 ? usableSpans : [pickBestAvailableSpan(availableSpans)];

      for (const span of spansForRow) {
        const range: LayoutLineRange | null = layoutNextLineRange(
          prepared,
          cursor,
          Math.max(1, span.width),
        );
        if (!range) {
          done = true;
          break;
        }

        const line = materializeLineRange(prepared, range);
        columnLines.push({
          ...line,
          xOffset: span.startX,
          yOffset: lineY,
          availableWidth: span.width,
        });
        cursor = range.end;
      }
      lineY += lineHeightPx;

      if (done) {
        break;
      }

      if (lineHeightPx > config.columnHeight) {
        break;
      }
    }

    columns.push({
      columnIndex,
      lines: columnLines,
      totalHeight: lineY,
      overflowed: columnLines.length === 1 && lineHeightPx > config.columnHeight,
    });

    emptyColumnsInRow = columnLines.length === 0 ? emptyColumnsInRow + 1 : 0;
    columnIndex++;

    if (!done && emptyColumnsInRow >= config.columnCount) {
      const range: LayoutLineRange | null = layoutNextLineRange(
        prepared,
        cursor,
        Math.max(1, config.columnWidth),
      );
      if (!range) {
        done = true;
      } else {
        const line = materializeLineRange(prepared, range);
        columns.push({
          columnIndex,
          lines: [{
            ...line,
            xOffset: 0,
            yOffset: 0,
            availableWidth: config.columnWidth,
          }],
          totalHeight: lineHeightPx,
          overflowed: lineHeightPx > config.columnHeight,
        });
        cursor = range.end;
        columnIndex++;
        emptyColumnsInRow = 0;
      }
    }
  }

  const layoutMs = performance.now() - t0;

  const t1 = performance.now();
  const pages = partitionIntoPages(annotateArticleRoles(columns, prepared, articleBlocks), config);
  const partitionMs = performance.now() - t1;
  const totalLines = columns.reduce((sum, column) => sum + column.lines.length, 0);

  return {
    result: {
      pages: pages.length > 0 ? pages : [{ pageIndex: 0, columns: [] }],
      pageCount: pages.length || 1,
      totalChars: text.length,
      totalLines,
    },
    metrics: {
      prepareMs: prepMetrics.prepareMs,
      layoutMs,
      partitionMs,
      totalMs: prepMetrics.prepareMs + layoutMs + partitionMs,
    },
    useFallback: false,
  };
}
