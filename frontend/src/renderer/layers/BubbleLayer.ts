/**
 * Transparent cursor obstacle outline.
 *
 * The primary cursor effect (mask-aware text reflow) is handled upstream by
 * Pretext layout. This layer only provides the visual affordance: a dashed
 * transparent circle showing the area that text wraps around. It deliberately
 * does not paint any center point or filled glow.
 */
export function drawBubbleLayer(
  ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  bubbleX: number,
  bubbleY: number,
  bubbleRadius: number,
  accentColor: string,
): void {
  if (bubbleRadius <= 0) return;

  const r = parseInt(accentColor.slice(1, 3), 16);
  const g = parseInt(accentColor.slice(3, 5), 16);
  const b = parseInt(accentColor.slice(5, 7), 16);

  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.46)`;
  ctx.beginPath();
  ctx.arc(bubbleX, bubbleY, bubbleRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
