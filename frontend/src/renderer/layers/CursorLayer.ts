export function drawCursorLayer(
  ctx: CanvasRenderingContext2D,
  cursorX: number,
  cursorY: number,
  accentColor: string,
  pageColor: string,
  customCursorImage?: HTMLImageElement | null,
): void {
  if (customCursorImage && customCursorImage.complete) {
    const size = 44;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.24)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(
      customCursorImage,
      cursorX - size / 2,
      cursorY - size / 2,
      size,
      size,
    );
    ctx.restore();
    return;
  }

  // Default cursor is intentionally invisible. The visible affordance is the
  // transparent/dashed obstacle circle drawn by BubbleLayer.
  void cursorX;
  void cursorY;
  void accentColor;
  void pageColor;
}
