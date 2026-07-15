import type { PageLayoutResult } from "../lib/pretext-engine";

export interface ThemeColors {
  pageBackground: string;
  pageText: string;
  pageMuted: string;
  pageAccent: string;
  accent: string;
  accentStrong: string;
  mask: string;
  maskTintAlpha: number;
  maskGlowAlpha: number;
  videoAlpha: number;
}

export interface RendererConfig {
  container: HTMLElement;
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface LayerCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  name: string;
}

export interface BubbleState {
  x: number;
  y: number;
  radius: number;
}

export interface CursorState {
  x: number;
  y: number;
  customImage: HTMLImageElement | null;
}

export interface TextLayerConfig {
  pageLayout: PageLayoutResult;
  pageIndex: number;
  columnCount: number;
  columnWidth: number;
  columnGap: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  pagePaddingX: number;
  pagePaddingY: number;
  /**
   * Base opacity for the text layer (0-1). Defaults to 1 (fully visible).
   */
  mutedAlpha?: number;
}

export interface CanvasRenderer {
  renderTextLayer(config: TextLayerConfig): void;
  /**
   * Renders the bubble accent glow layer.
   */
  renderBubbleLayer(bubble: BubbleState): void;
  renderCursorLayer(cursor: CursorState): void;
  renderBackgroundLayer(videoElement?: HTMLVideoElement | null): void;
  /**
   * Legacy hook retained for the renderer interface. Cursor-driven text flow is
   * handled by mask-aware Pretext layout; this method should not mutate text.
   */
  setCursorState(x: number, y: number, radius: number): void;
  /** Updates the cached theme colors and re-renders the affected layers. */
  updateColors(): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
