/**
 * Standalone Canvas reader for the Zotero plugin.
 * No React/Zustand dependency — uses @chenglou/pretext for layout and Canvas 2D for rendering.
 */

import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";
import type { PreparedTextWithSegments, LayoutLine } from "@chenglou/pretext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReaderConfig {
  columnCount: number;
  columnGap: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: "dark" | "light" | "sepia";
}

interface ThemeColors {
  bg: string;
  page: string;
  pageText: string;
  accent: string;
  muted: string;
}

interface PageLayout {
  columns: { lines: LayoutLine[] }[];
}

const THEMES: Record<string, ThemeColors> = {
  dark: { bg: "#111318", page: "#171b23", pageText: "#f3eadf", accent: "#f4d35e", muted: "#a9adba" },
  light: { bg: "#e8edf4", page: "#ffffff", pageText: "#1e2430", accent: "#2f80ed", muted: "#5c6675" },
  sepia: { bg: "#ded1bd", page: "#f8eedc", pageText: "#2e2419", accent: "#a85524", muted: "#6b5c4d" },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let config: ReaderConfig = {
  columnCount: 2,
  columnGap: 42,
  fontSize: 18,
  lineHeight: 1.65,
  fontFamily: "system-ui, sans-serif",
  theme: "dark",
};

let pageLayout: PageLayout | null = null;
let cursor = { x: 400, y: 300 };
let targetCursor = { x: 400, y: 300 };
let bubbleRadius = 80;
let rafId = 0;

// Canvas elements
let bgCanvas: HTMLCanvasElement;
let textCanvas: HTMLCanvasElement;
let bubbleCanvas: HTMLCanvasElement;
let cursorCanvas: HTMLCanvasElement;
let bgCtx: CanvasRenderingContext2D;
let textCtx: CanvasRenderingContext2D;
let bubbleCtx: CanvasRenderingContext2D;
let cursorCtx: CanvasRenderingContext2D;
let containerWidth = 800;
let containerHeight = 600;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function doLayout(text: string): PageLayout | null {
  const font = `${config.fontSize}px ${config.fontFamily}`;
  const pageWidth = containerWidth - 80; // 40px padding each side
  const pageHeight = containerHeight - 80;
  const totalGap = (config.columnCount - 1) * config.columnGap;
  const colWidth = Math.max(120, (pageWidth - totalGap) / config.columnCount);
  const lineH = config.fontSize * config.lineHeight;

  let prepared: PreparedTextWithSegments;
  try {
    prepared = prepareWithSegments(text, font, { wordBreak: "normal" });
  } catch {
    return null;
  }

  const result = layoutWithLines(prepared, colWidth, lineH);
  const lines = result.lines;

  // Partition into columns
  const columns: { lines: LayoutLine[] }[] = [];
  let lineIdx = 0;
  for (let col = 0; col < config.columnCount && lineIdx < lines.length; col++) {
    const colLines: LayoutLine[] = [];
    let y = 0;
    while (lineIdx < lines.length) {
      if (y + lineH > pageHeight && colLines.length > 0) break;
      colLines.push(lines[lineIdx]);
      y += lineH;
      lineIdx++;
    }
    columns.push({ lines: colLines });
  }

  return { columns };
}

// ---------------------------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------------------------

function getColors(): ThemeColors {
  return THEMES[config.theme] ?? THEMES.dark;
}

function setupCanvases(container: HTMLElement): void {
  const dpr = window.devicePixelRatio || 1;
  const createLayer = (z: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const c = document.createElement("canvas");
    c.style.cssText = `position:absolute;inset:0;z-index:${z};width:100%;height:100%`;
    c.width = containerWidth * dpr;
    c.height = containerHeight * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    container.appendChild(c);
    return [c, ctx];
  };

  [bgCanvas, bgCtx] = createLayer(1);
  [textCanvas, textCtx] = createLayer(2);
  [bubbleCanvas, bubbleCtx] = createLayer(3);
  [cursorCanvas, cursorCtx] = createLayer(4);
}

function drawBackground(): void {
  const colors = getColors();
  const w = containerWidth;
  const h = containerHeight;

  bgCtx.fillStyle = colors.page;
  bgCtx.fillRect(0, 0, w, h);

  // Accent gradient
  const grad = bgCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, hexToRgba(colors.accent, 0.08));
  grad.addColorStop(0.32, "transparent");
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, w, h);
}

function drawText(): void {
  if (!pageLayout) return;

  const colors = getColors();
  const pageWidth = containerWidth - 80;
  const totalGap = (config.columnCount - 1) * config.columnGap;
  const colWidth = Math.max(120, (pageWidth - totalGap) / config.columnCount);
  const lineH = config.fontSize * config.lineHeight;

  textCtx.clearRect(0, 0, containerWidth, containerHeight);
  textCtx.font = `${config.fontSize}px ${config.fontFamily}`;
  textCtx.fillStyle = colors.pageText;
  textCtx.textBaseline = "alphabetic";

  for (const column of pageLayout.columns) {
    const colIdx = pageLayout.columns.indexOf(column);
    const colX = 40 + colIdx * (colWidth + config.columnGap);
    let y = 40;

    for (const line of column.lines) {
      textCtx.fillText(line.text, colX, y + config.fontSize);
      y += lineH;
    }
  }
}

function drawBubble(): void {
  if (bubbleRadius <= 0) return;

  const colors = getColors();
  bubbleCtx.clearRect(0, 0, containerWidth, containerHeight);

  const grad = bubbleCtx.createRadialGradient(
    cursor.x, cursor.y, bubbleRadius * 0.6,
    cursor.x, cursor.y, bubbleRadius,
  );
  grad.addColorStop(0, hexToRgba(colors.accent, 0.26));
  grad.addColorStop(0.72, "transparent");

  bubbleCtx.save();
  bubbleCtx.globalCompositeOperation = "screen";
  bubbleCtx.fillStyle = grad;
  bubbleCtx.fillRect(0, 0, containerWidth, containerHeight);
  bubbleCtx.restore();
}

function drawCursor(): void {
  const colors = getColors();
  cursorCtx.clearRect(0, 0, containerWidth, containerHeight);

  // Glow
  cursorCtx.beginPath();
  cursorCtx.arc(cursor.x, cursor.y, 13, 0, Math.PI * 2);
  cursorCtx.fillStyle = hexToRgba(colors.accent, 0.18);
  cursorCtx.fill();

  // Main dot
  cursorCtx.beginPath();
  cursorCtx.arc(cursor.x, cursor.y, 8, 0, Math.PI * 2);
  cursorCtx.fillStyle = colors.accent;
  cursorCtx.fill();
  cursorCtx.strokeStyle = colors.page;
  cursorCtx.lineWidth = 2;
  cursorCtx.stroke();
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------

function animate(): void {
  // Lerp cursor toward target
  cursor.x += (targetCursor.x - cursor.x) * 0.3;
  cursor.y += (targetCursor.y - cursor.y) * 0.3;

  drawBubble();
  drawCursor();
  rafId = requestAnimationFrame(animate);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CanvasReaderAPI {
  render(text: string): void;
  setTheme(theme: "dark" | "light" | "sepia"): void;
  setColumns(n: number): void;
  setFontSize(n: number): void;
  setBubbleRadius(r: number): void;
  resize(w: number, h: number): void;
  updateCursor(x: number, y: number): void;
  destroy(): void;
}

export function createCanvasReader(
  container: HTMLElement,
  initialConfig?: Partial<ReaderConfig>,
): CanvasReaderAPI {
  if (initialConfig) {
    Object.assign(config, initialConfig);
  }

  containerWidth = container.clientWidth || 800;
  containerHeight = container.clientHeight || 600;
  container.style.position = "relative";
  container.style.overflow = "hidden";

  setupCanvases(container);
  drawBackground();
  rafId = requestAnimationFrame(animate);

  return {
    render(text: string): void {
      const trimmed = text.trim();
      if (!trimmed) return;

      pageLayout = doLayout(trimmed);
      drawText();
    },

    setTheme(theme: "dark" | "light" | "sepia"): void {
      config.theme = theme;
      document.body.style.background = THEMES[theme]?.bg ?? THEMES.dark.bg;
      document.body.style.color = THEMES[theme]?.pageText ?? THEMES.dark.pageText;
      drawBackground();
      drawText();
    },

    setColumns(n: number): void {
      config.columnCount = Math.min(4, Math.max(1, n));
    },

    setFontSize(n: number): void {
      config.fontSize = Math.min(28, Math.max(12, n));
    },

    setBubbleRadius(r: number): void {
      bubbleRadius = Math.min(150, Math.max(0, r));
    },

    resize(w: number, h: number): void {
      containerWidth = w;
      containerHeight = h;
      const dpr = window.devicePixelRatio || 1;
      for (const c of [bgCanvas, textCanvas, bubbleCanvas, cursorCanvas]) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      [bgCtx, textCtx, bubbleCtx, cursorCtx].forEach((ctx) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      });
      drawBackground();
      drawText();
    },

    updateCursor(x: number, y: number): void {
      targetCursor.x = x;
      targetCursor.y = y;
    },

    destroy(): void {
      cancelAnimationFrame(rafId);
      for (const c of [bgCanvas, textCanvas, bubbleCanvas, cursorCanvas]) {
        c.remove();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
