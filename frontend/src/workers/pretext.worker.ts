// Pretext layout worker — runs text preparation and line layout off the main thread.
// Uses @chenglou/pretext's prepareWithSegments + layoutWithLines internally.

import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";
import type { PreparedTextWithSegments, LayoutLinesResult } from "@chenglou/pretext";
import { roleForTextOffset, type ArticleBlock, type ArticleLineRole } from "../lib/articleStructure";

// ---------------------------------------------------------------------------
// Types (mirrored from pretext-engine.ts to keep the worker self-contained)
// ---------------------------------------------------------------------------

interface LayoutConfig {
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

interface LayoutLine {
  text: string;
  width: number;
  start: { segmentIndex: number; graphemeIndex: number };
  end: { segmentIndex: number; graphemeIndex: number };
  xOffset?: number;
  yOffset?: number;
  availableWidth?: number;
  role?: ArticleLineRole;
}

interface ColumnLayout {
  columnIndex: number;
  lines: LayoutLine[];
  totalHeight: number;
  overflowed: boolean;
}

interface PageLayout {
  pageIndex: number;
  columns: ColumnLayout[];
}

interface PageLayoutResult {
  pages: PageLayout[];
  pageCount: number;
  totalChars: number;
  totalLines: number;
}

interface EngineMetrics {
  prepareMs: number;
  layoutMs: number;
  partitionMs: number;
  totalMs: number;
}

interface LayoutRequest {
  type: "layout";
  text: string;
  config: LayoutConfig;
  articleBlocks?: ArticleBlock[];
}

interface LayoutResponse {
  type: "result";
  result: PageLayoutResult;
  metrics: EngineMetrics;
  useFallback: false;
}

interface ErrorResponse {
  type: "error";
  message: string;
}

// ---------------------------------------------------------------------------
// Font helpers
// ---------------------------------------------------------------------------

function buildFontString(fontSize: number, fontFamily: string): string {
  return `${fontSize}px ${fontFamily}`;
}

// ---------------------------------------------------------------------------
// Column / page partitioning
// ---------------------------------------------------------------------------

function partitionIntoColumns(
  lines: LayoutLine[],
  config: LayoutConfig,
  prepared: PreparedTextWithSegments,
  articleBlocks: ArticleBlock[],
): ColumnLayout[] {
  const lineHeightPx = config.fontSize * config.lineHeight;
  const columns: ColumnLayout[] = [];
  let columnIndex = 0;

  for (let i = 0; i < lines.length; ) {
    const columnLines: LayoutLine[] = [];
    let accumulatedHeight = 0;

    while (i < lines.length) {
      const nextHeight = accumulatedHeight + lineHeightPx;
      if (columnLines.length > 0 && nextHeight > config.columnHeight) {
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
      overflowed: columnLines.length === 1 && lineHeightPx > config.columnHeight,
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

function annotateArticleRoles(
  columns: ColumnLayout[],
  prepared: PreparedTextWithSegments,
  articleBlocks: ArticleBlock[],
): ColumnLayout[] {
  if (articleBlocks.length === 0) return columns;

  const offsets = segmentStartOffsets(prepared);
  return columns.map((column) => ({
    ...column,
    lines: column.lines.map((line) => {
      const offset = (offsets[line.start.segmentIndex] ?? 0) + line.start.graphemeIndex;
      return {
        ...line,
        role: line.text.trim() ? roleForTextOffset(articleBlocks, offset) : "body",
      };
    }),
  }));
}

function partitionIntoPages(
  columns: ColumnLayout[],
  config: LayoutConfig,
): PageLayout[] {
  const pages: PageLayout[] = [];

  for (let i = 0; i < columns.length; i += config.columnCount) {
    const pageColumns = columns.slice(i, i + config.columnCount).map((column, localIndex) => ({
      ...column,
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
// Main layout (runs entirely in the worker)
// ---------------------------------------------------------------------------

function doLayout(
  text: string,
  config: LayoutConfig,
  articleBlocks: ArticleBlock[] = [],
): { result: PageLayoutResult; metrics: EngineMetrics } {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      result: { pages: [], pageCount: 0, totalChars: text.length, totalLines: 0 },
      metrics: { prepareMs: 0, layoutMs: 0, partitionMs: 0, totalMs: 0 },
    };
  }

  const fontString = buildFontString(config.fontSize, config.fontFamily);
  const lineHeightPx = config.fontSize * config.lineHeight;

  // Prepare
  const t0 = performance.now();
  const prepared: PreparedTextWithSegments = prepareWithSegments(text, fontString, {
    whiteSpace: "pre-wrap",
    wordBreak: "normal",
  });
  const prepareMs = performance.now() - t0;

  // Layout
  const t1 = performance.now();
  const layoutResult: LayoutLinesResult = layoutWithLines(
    prepared,
    config.columnWidth,
    lineHeightPx,
  );
  const layoutMs = performance.now() - t1;

  // Partition
  const t2 = performance.now();
  const columns = partitionIntoColumns(layoutResult.lines, config, prepared, articleBlocks);
  const pages = partitionIntoPages(columns, config);
  const partitionMs = performance.now() - t2;

  return {
    result: {
      pages: pages.length > 0 ? pages : [{ pageIndex: 0, columns: [] }],
      pageCount: pages.length || 1,
      totalChars: text.length,
      totalLines: layoutResult.lines.length,
    },
    metrics: {
      prepareMs,
      layoutMs,
      partitionMs,
      totalMs: prepareMs + layoutMs + partitionMs,
    },
  };
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { type, text, config, articleBlocks = [] } = event.data;

  if (type !== "layout") {
    return;
  }

  try {
    const { result, metrics } = doLayout(text, config, articleBlocks);

    const response: LayoutResponse = {
      type: "result",
      result,
      metrics,
      useFallback: false,
    };

    self.postMessage(response);
  } catch (err) {
    const response: ErrorResponse = {
      type: "error",
      message: err instanceof Error ? err.message : "Worker layout failed",
    };

    self.postMessage(response);
  }
};
