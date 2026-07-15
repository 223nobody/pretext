import type {
  BubbleState,
  CanvasRenderer as ICanvasRenderer,
  CursorState,
  LayerCanvas,
  RendererConfig,
  TextLayerConfig,
  ThemeColors,
} from "./types";
import { readThemeColor } from "./fonts";
import { drawBackgroundLayer } from "./layers/BackgroundLayer";
import { drawBubbleLayer } from "./layers/BubbleLayer";
import { drawCursorLayer } from "./layers/CursorLayer";
import { drawTextLayer } from "./layers/TextLayer";

function createLayerCanvas(
  container: HTMLElement,
  config: RendererConfig,
  name: string,
  zIndex: number,
): LayerCanvas {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.zIndex = String(zIndex);
  canvas.style.width = `${config.width}px`;
  canvas.style.height = `${config.height}px`;
  canvas.style.pointerEvents = "none"; // let pointer events reach the parent for onPointerMove
  canvas.width = config.width * config.devicePixelRatio;
  canvas.height = config.height * config.devicePixelRatio;
  canvas.setAttribute("data-layer", name);

  const ctx = canvas.getContext("2d")!;
  ctx.scale(config.devicePixelRatio, config.devicePixelRatio);

  container.appendChild(canvas);
  return { canvas, ctx, name };
}

function getThemeColors(): ThemeColors {
  const pageText = readThemeColor("--page-text") || "#020617";
  const accent = readThemeColor("--accent") || "#2d74cc";
  return {
    pageBackground: readThemeColor("--page") || "#ffffff",
    pageText,
    pageMuted: readThemeColor("--page-muted") || readThemeColor("--muted") || pageText,
    pageAccent: readThemeColor("--page-accent") || accent,
    accent,
    accentStrong: readThemeColor("--accent-strong") || "#1d5faa",
    mask: readThemeColor("--mask") || accent,
    maskTintAlpha: readThemeAlpha("--reader-mask-tint", 0.18),
    maskGlowAlpha: readThemeAlpha("--reader-mask-glow", 0.08),
    videoAlpha: readThemeAlpha("--reader-video-opacity", 0.58),
  };
}

function readThemeAlpha(varName: string, fallback: number): number {
  const raw = readThemeColor(varName);
  if (!raw) return fallback;
  const value = raw.endsWith("%")
    ? Number.parseFloat(raw) / 100
    : Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export function createCanvasRenderer(config: RendererConfig): ICanvasRenderer {
  const { container } = config;
  let currentWidth = config.width;
  let currentHeight = config.height;
  let currentDevicePixelRatio = config.devicePixelRatio;

  const layers: Record<string, LayerCanvas> = {
    background: createLayerCanvas(container, config, "background", 1),
    text: createLayerCanvas(container, config, "text", 2),
    bubble: createLayerCanvas(container, config, "bubble", 3),
    cursor: createLayerCanvas(container, config, "cursor", 4),
  };

  let lastTextConfig: TextLayerConfig | null = null;
  let lastBubble: BubbleState | null = null;
  let lastCursor: CursorState | null = null;
  let lastVideo: HTMLVideoElement | null = null;
  // Cache theme colors so the RAF loop doesn't hit getComputedStyle every frame.
  let colors = getThemeColors();

  const clearLayer = (name: string) => {
    const layer = layers[name];
    if (!layer) return;
    layer.ctx.clearRect(0, 0, currentWidth, currentHeight);
  };

  const drawText = () => {
    if (!lastTextConfig) return;
    clearLayer("text");
    drawTextLayer(layers.text.ctx, lastTextConfig, colors);
  };

  const drawBubble = () => {
    clearLayer("bubble");
    if (!lastBubble) return;
    drawBubbleLayer(
      layers.bubble.ctx,
      currentWidth,
      currentHeight,
      lastBubble.x,
      lastBubble.y,
      lastBubble.radius,
      colors.mask,
    );
  };

  const drawCursor = () => {
    clearLayer("cursor");
    if (!lastCursor) return;
    drawCursorLayer(
      layers.cursor.ctx,
      lastCursor.x,
      lastCursor.y,
      colors.mask,
      colors.pageBackground,
      lastCursor.customImage,
    );
  };

  const drawBackground = () => {
    clearLayer("background");
    drawBackgroundLayer(
      layers.background.ctx,
      currentWidth,
      currentHeight,
      colors,
      lastVideo,
    );
  };

  return {
    renderTextLayer(textConfig: TextLayerConfig): void {
      lastTextConfig = textConfig;
      drawText();
    },

    setCursorState(_x: number, _y: number, _radius: number): void {
      // Kept for the renderer interface. Cursor-driven text changes now happen
      // upstream through mask-aware Pretext layout, not by redrawing this layer
      // with post-layout displacement.
    },

    renderBubbleLayer(bubble: BubbleState): void {
      lastBubble = bubble;
      drawBubble();
    },

    renderCursorLayer(cursor: CursorState): void {
      lastCursor = cursor;
      drawCursor();
    },

    renderBackgroundLayer(videoElement?: HTMLVideoElement | null): void {
      // undefined means "keep the previous video"; null means "clear it".
      if (videoElement !== undefined) {
        lastVideo = videoElement;
      }
      drawBackground();
    },

    updateColors(): void {
      colors = getThemeColors();
      drawBackground();
      drawText();
      drawBubble();
      drawCursor();
    },

    resize(width: number, height: number): void {
      currentWidth = width;
      currentHeight = height;
      currentDevicePixelRatio =
        typeof window === "undefined"
          ? currentDevicePixelRatio
          : window.devicePixelRatio || currentDevicePixelRatio;

      for (const layer of Object.values(layers)) {
        layer.canvas.style.width = `${width}px`;
        layer.canvas.style.height = `${height}px`;
        layer.canvas.width = width * currentDevicePixelRatio;
        layer.canvas.height = height * currentDevicePixelRatio;
        layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        layer.ctx.scale(currentDevicePixelRatio, currentDevicePixelRatio);
      }
      // Re-render everything with new dimensions.
      drawBackground();
      drawText();
      drawBubble();
      drawCursor();
    },

    destroy(): void {
      for (const layer of Object.values(layers)) {
        layer.canvas.remove();
      }
    },
  };
}
