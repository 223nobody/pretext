import type { ThemeColors } from "../types";

export function drawBackgroundLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: ThemeColors,
  videoElement?: HTMLVideoElement | null,
): void {
  // Base fill
  ctx.fillStyle = colors.pageBackground;
  ctx.fillRect(0, 0, width, height);

  // Theme-specific reader mask gradient.
  const linGrad = ctx.createLinearGradient(0, 0, width, height);
  linGrad.addColorStop(0, hexToRgba(colors.mask, colors.maskTintAlpha));
  linGrad.addColorStop(0.32, "transparent");
  ctx.fillStyle = linGrad;
  ctx.fillRect(0, 0, width, height);

  // Theme-specific reader mask radial glow.
  const radGrad = ctx.createRadialGradient(
    width * 0.86,
    height * 0.18,
    0,
    width * 0.86,
    height * 0.18,
    Math.max(width, height) * 0.26,
  );
  radGrad.addColorStop(0, hexToRgba(colors.mask, colors.maskGlowAlpha));
  radGrad.addColorStop(1, "transparent");
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, width, height);

  // Video frame overlay
  if (videoElement && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    ctx.globalAlpha = colors.videoAlpha;
    drawVideoContain(ctx, videoElement, width, height);
    ctx.globalAlpha = 1;
  }
}

function drawVideoContain(
  ctx: CanvasRenderingContext2D,
  videoElement: HTMLVideoElement,
  width: number,
  height: number,
): void {
  const videoWidth = videoElement.videoWidth || width;
  const videoHeight = videoElement.videoHeight || height;
  const scale = Math.min(width / videoWidth, height / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  ctx.drawImage(videoElement, drawX, drawY, drawWidth, drawHeight);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
