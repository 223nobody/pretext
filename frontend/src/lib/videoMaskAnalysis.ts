import {
  analyzeContour,
  connectedComponents,
  dilate,
  extractSpans,
  pickDominant,
  type BinaryField,
  type ContourResult,
  type RowSpan,
} from "./videoContourAnalysis";

export interface VideoMaskOptions {
  sensitivity: number;
  inverted: boolean;
  edgePrecision: number;
}

export interface VideoMaskResult {
  x: number; // center X as percentage 0-100
  y: number; // center Y as percentage 0-100
  size: number; // mask size in pixels (140-420)
  contour: {
    spans: RowSpan[];
    frameWidth: number;
    frameHeight: number;
  };
}

export interface SampledVideoFrame {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface VideoBackgroundModel {
  data: Float32Array; // RGB averages, row-major, 3 values per pixel
  width: number;
  height: number;
}

/**
 * Analysis resolution (see NEXT_DEVELOPMENT_PLAN §5.1.1). 160px wide is a good
 * balance between silhouette fidelity and per-frame cost; the height follows
 * the video's aspect ratio.
 */
const ANALYSIS_WIDTH = 192;

/**
 * Draws the current video frame to a small offscreen canvas and returns its
 * RGBA buffer plus dimensions. Returns null if the frame isn't ready or a 2D
 * context can't be obtained.
 */
export function sampleVideoFrame(
  video: HTMLVideoElement,
  targetWidth = ANALYSIS_WIDTH,
): SampledVideoFrame | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const width = targetWidth;
  const height = Math.max(
    Math.round(targetWidth * 0.5625),
    Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * width),
  );
  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);

  const rgba = context.getImageData(0, 0, width, height).data;
  return { rgba, width, height };
}

export function frameHasAlpha(frame: SampledVideoFrame, transparentThreshold = 240): boolean {
  const { rgba } = frame;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < transparentThreshold) return true;
  }
  return false;
}

export function createBackgroundModel(frames: SampledVideoFrame[]): VideoBackgroundModel | null {
  const first = frames[0];
  if (!first) return null;

  const { width, height } = first;
  const sums = new Float64Array(width * height * 3);
  let count = 0;

  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) continue;
    for (let i = 0; i < width * height; i++) {
      sums[i * 3] += frame.rgba[i * 4];
      sums[i * 3 + 1] += frame.rgba[i * 4 + 1];
      sums[i * 3 + 2] += frame.rgba[i * 4 + 2];
    }
    count++;
  }

  if (count === 0) return null;

  const data = new Float32Array(width * height * 3);
  for (let i = 0; i < data.length; i++) {
    data[i] = sums[i] / count;
  }

  return { data, width, height };
}

function contourFromBinary(
  binary: BinaryField,
  edgePrecision: number,
): ContourResult | null {
  const dilated = dilate(binary, Math.max(2, Math.round(edgePrecision * 0.85)));
  const { labels, components } = connectedComponents(dilated);
  const dominant = pickDominant(components, binary.width, binary.height);
  const minArea = Math.max(12, binary.width * binary.height * 0.015);

  if (!dominant || dominant.pixels < minArea) {
    return null;
  }

  return {
    bounds: {
      minX: dominant.minX,
      minY: dominant.minY,
      maxX: dominant.maxX,
      maxY: dominant.maxY,
    },
    spans: extractSpans(labels, binary.width, binary.height, dominant.label),
    area: dominant.pixels,
    width: binary.width,
    height: binary.height,
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function smoothReadableSpans(
  spans: RowSpan[],
  frameWidth: number,
  frameHeight: number,
  edgePrecision: number,
): RowSpan[] {
  const rowSpans: Array<{ left: number; right: number } | null> = Array.from(
    { length: frameHeight },
    () => null,
  );
  const paddingX = Math.max(2, Math.round(edgePrecision * 0.75));

  for (const span of spans) {
    const row = clampInt(span.row, 0, frameHeight - 1);
    const padded = {
      left: clampInt(span.left - paddingX, 0, frameWidth - 1),
      right: clampInt(span.right + paddingX, 0, frameWidth - 1),
    };
    const current = rowSpans[row];
    rowSpans[row] = current
      ? {
        left: Math.min(current.left, padded.left),
        right: Math.max(current.right, padded.right),
      }
      : padded;
  }

  const smoothingRadius = 2;
  const smoothed: RowSpan[] = [];

  for (let row = 0; row < frameHeight; row++) {
    const current = rowSpans[row];
    const lefts: number[] = [];
    const rights: number[] = [];

    for (
      let neighbor = Math.max(0, row - smoothingRadius);
      neighbor <= Math.min(frameHeight - 1, row + smoothingRadius);
      neighbor++
    ) {
      const neighborSpan = rowSpans[neighbor];
      if (!neighborSpan) continue;
      lefts.push(neighborSpan.left);
      rights.push(neighborSpan.right);
    }

    if (lefts.length === 0 || (!current && lefts.length < 2)) {
      continue;
    }

    const medianLeft = median(lefts);
    const medianRight = median(rights);
    const left = current
      ? clampInt(current.left * 0.45 + medianLeft * 0.55, 0, frameWidth - 1)
      : clampInt(medianLeft, 0, frameWidth - 1);
    const right = current
      ? clampInt(current.right * 0.45 + medianRight * 0.55, 0, frameWidth - 1)
      : clampInt(medianRight, 0, frameWidth - 1);

    if (right > left) {
      smoothed.push({ row, left, right });
    }
  }

  return smoothed.length > 0 ? smoothed : spans;
}

function boundsFromSpans(
  spans: RowSpan[],
  fallback: ContourResult["bounds"],
): ContourResult["bounds"] {
  if (spans.length === 0) return fallback;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;

  for (const span of spans) {
    minX = Math.min(minX, span.left);
    minY = Math.min(minY, span.row);
    maxX = Math.max(maxX, span.right);
    maxY = Math.max(maxY, span.row);
  }

  return { minX, minY, maxX, maxY };
}

function contourFromAlpha(
  frame: SampledVideoFrame,
  options: VideoMaskOptions,
): ContourResult | null {
  const binary = new Uint8Array(frame.width * frame.height);
  for (let i = 0; i < binary.length; i++) {
    const alpha = frame.rgba[i * 4 + 3];
    binary[i] = alpha > 30 ? 1 : 0;
  }
  return contourFromBinary(
    { data: binary, width: frame.width, height: frame.height },
    Math.max(1, Math.min(options.edgePrecision, 3)),
  );
}

function contourFromBackgroundDifference(
  frame: SampledVideoFrame,
  backgroundModel: VideoBackgroundModel,
  options: VideoMaskOptions,
): ContourResult | null {
  if (backgroundModel.width !== frame.width || backgroundModel.height !== frame.height) {
    return null;
  }

  const binary = new Uint8Array(frame.width * frame.height);
  // Textdance uses an RGB-distance threshold around 38. Map the existing
  // sensitivity slider so higher sensitivity keeps weaker foreground changes.
  const threshold = Math.max(12, 72 - options.sensitivity * 0.7);
  const thresholdSq = threshold * threshold;

  for (let i = 0; i < binary.length; i++) {
    const dr = frame.rgba[i * 4] - backgroundModel.data[i * 3];
    const dg = frame.rgba[i * 4 + 1] - backgroundModel.data[i * 3 + 1];
    const db = frame.rgba[i * 4 + 2] - backgroundModel.data[i * 3 + 2];
    const changed = dr * dr + dg * dg + db * db > thresholdSq;
    binary[i] = options.inverted ? (changed ? 0 : 1) : (changed ? 1 : 0);
  }

  return contourFromBinary(
    { data: binary, width: frame.width, height: frame.height },
    options.edgePrecision,
  );
}

function toVideoMaskResult(
  frame: SampledVideoFrame,
  contour: ContourResult,
  options: VideoMaskOptions,
): VideoMaskResult {
  const readableSpans = smoothReadableSpans(
    contour.spans,
    frame.width,
    frame.height,
    options.edgePrecision,
  );
  const { minX, minY, maxX, maxY } = boundsFromSpans(readableSpans, contour.bounds);
  const centerX = ((minX + maxX) / 2 / frame.width) * 100;
  const centerY = ((minY + maxY) / 2 / frame.height) * 100;
  const spanX = (maxX - minX) / frame.width;
  const spanY = (maxY - minY) / frame.height;
  const span = Math.max(spanX, spanY);

  return {
    x: Math.round(centerX),
    y: Math.round(centerY),
    size: Math.round(Math.min(420, Math.max(140, span * 620))),
    contour: {
      spans: readableSpans,
      frameWidth: frame.width,
      frameHeight: frame.height,
    },
  };
}

export function analyzeVideoFrameSample(
  frame: SampledVideoFrame,
  options: VideoMaskOptions,
  backgroundModel?: VideoBackgroundModel | null,
): VideoMaskResult | null {
  const contour = frameHasAlpha(frame)
    ? contourFromAlpha(frame, options)
    : backgroundModel
      ? contourFromBackgroundDifference(frame, backgroundModel, options)
      : analyzeContour(frame.rgba, frame.width, frame.height, {
        sensitivity: options.sensitivity,
        edgePrecision: options.edgePrecision,
        inverted: options.inverted,
      });

  return contour ? toVideoMaskResult(frame, contour, options) : null;
}

/**
 * Analyzes a video frame to detect the dominant visual subject.
 *
 * Now backed by the edge-detection + connected-component pipeline in
 * `videoContourAnalysis` (see NEXT_DEVELOPMENT_PLAN §5.1). Still returns the
 * compact centre/size shape the store and CSS renderer consume; the full
 * per-row silhouette is exposed separately via {@link analyzeVideoContour}.
 */
export function analyzeVideoFrame(
  video: HTMLVideoElement,
  options: VideoMaskOptions,
  backgroundModel?: VideoBackgroundModel | null,
): VideoMaskResult | null {
  const frame = sampleVideoFrame(video);
  if (!frame) return null;
  return analyzeVideoFrameSample(frame, options, backgroundModel);
}
