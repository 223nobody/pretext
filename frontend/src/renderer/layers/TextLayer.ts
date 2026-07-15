import type { TextLayerConfig, ThemeColors } from "../types";
import type { ArticleLineRole } from "../../lib/articleStructure";

function getRoleStyle(
  role: ArticleLineRole | undefined,
  fontSize: number,
  fontFamily: string,
  colors: ThemeColors,
) {
  switch (role) {
    case "title":
      return {
        fontSize: fontSize * 1.18,
        font: `700 ${Math.round(fontSize * 1.18)}px ${fontFamily}`,
        fillStyle: colors.pageText,
      };
    case "author":
      return {
        fontSize: fontSize * 0.86,
        font: `${Math.round(fontSize * 0.86)}px ${fontFamily}`,
        fillStyle: colors.pageMuted,
      };
    case "abstract-heading":
      return {
        fontSize: fontSize * 0.92,
        font: `700 ${Math.round(fontSize * 0.92)}px ${fontFamily}`,
        fillStyle: colors.pageAccent,
      };
    case "abstract-body":
      return {
        fontSize: fontSize * 1.02,
        font: `${fontSize}px ${fontFamily}`,
        fillStyle: colors.pageText,
      };
    case "section-heading":
      return {
        fontSize: fontSize * 1.1,
        font: `700 ${Math.round(fontSize * 1.1)}px ${fontFamily}`,
        fillStyle: colors.pageText,
      };
    case "metadata":
      return {
        fontSize: fontSize * 0.78,
        font: `${Math.round(fontSize * 0.78)}px ${fontFamily}`,
        fillStyle: colors.pageMuted,
      };
    default:
      return {
        fontSize,
        font: `${fontSize}px ${fontFamily}`,
        fillStyle: colors.pageText,
      };
  }
}

/**
 * Draws the current page's already-laid-out text onto a canvas 2D context.
 *
 * Textdance-style cursor interaction is handled upstream by the mask-aware
 * Pretext layout pipeline: the cursor becomes an ellipse obstacle and line
 * ranges are recomputed around it. This layer deliberately avoids post-layout
 * glyph displacement so the rendered text matches the layout geometry.
 */
export function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  config: TextLayerConfig,
  colors: ThemeColors,
  viewportTop: number = 0,
  viewportBottom: number = Infinity,
): void {
  const {
    pageLayout,
    pageIndex,
    columnWidth,
    columnGap,
    fontSize,
    lineHeight,
    fontFamily,
    pagePaddingX,
    pagePaddingY,
    mutedAlpha,
  } = config;

  const page = pageLayout.pages[pageIndex];
  if (!page) return;

  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = mutedAlpha === undefined ? 1 : Math.max(0, Math.min(1, mutedAlpha));

  const lineH = fontSize * lineHeight;

  for (const column of page.columns) {
    const colX = pagePaddingX + column.columnIndex * (columnWidth + columnGap);

    for (let lineIndex = 0; lineIndex < column.lines.length; lineIndex++) {
      const line = column.lines[lineIndex];
      const currentY = pagePaddingY + (line.yOffset ?? lineIndex * lineH);
      const lineTop = currentY;
      const lineBottom = currentY + lineH;

      // Viewport culling: skip lines outside the visible area.
      if (lineBottom < viewportTop) {
        continue;
      }
      if (lineTop > viewportBottom) {
        break;
      }

      const style = getRoleStyle(line.role, fontSize, fontFamily, colors);
      ctx.font = style.font;
      ctx.fillStyle = style.fillStyle;
      const baseline = currentY + (lineH + style.fontSize * 0.72) / 2;
      ctx.fillText(line.text, colX + (line.xOffset ?? 0), baseline);
    }
  }

  ctx.globalAlpha = 1;
}
