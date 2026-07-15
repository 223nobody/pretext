import { describe, expect, it } from "vitest";

import {
  analyzeVideoFrameSample,
  createBackgroundModel,
  frameHasAlpha,
  type SampledVideoFrame,
} from "./videoMaskAnalysis";

function makeFrame(width: number, height: number, fill: [number, number, number, number]): SampledVideoFrame {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = fill[0];
    rgba[i * 4 + 1] = fill[1];
    rgba[i * 4 + 2] = fill[2];
    rgba[i * 4 + 3] = fill[3];
  }
  return { rgba, width, height };
}

function fillRect(
  frame: SampledVideoFrame,
  x0: number,
  y0: number,
  w: number,
  h: number,
  fill: [number, number, number, number],
) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = y * frame.width + x;
      frame.rgba[i * 4] = fill[0];
      frame.rgba[i * 4 + 1] = fill[1];
      frame.rgba[i * 4 + 2] = fill[2];
      frame.rgba[i * 4 + 3] = fill[3];
    }
  }
}

describe("video mask frame analysis", () => {
  it("uses alpha as an obstacle mask for transparent videos", () => {
    const frame = makeFrame(40, 30, [0, 0, 0, 0]);
    fillRect(frame, 12, 8, 16, 12, [255, 255, 255, 255]);

    expect(frameHasAlpha(frame)).toBe(true);

    const result = analyzeVideoFrameSample(frame, {
      sensitivity: 40,
      edgePrecision: 2,
      inverted: false,
    });

    expect(result).not.toBeNull();
    expect(result!.contour.spans.length).toBeGreaterThan(0);
    expect(result!.x).toBeGreaterThan(40);
    expect(result!.x).toBeLessThan(60);
    const middleSpan = result!.contour.spans.find((span) => span.row === 14);
    expect(middleSpan).toBeDefined();
    expect(middleSpan!.left).toBeLessThan(12);
    expect(middleSpan!.right).toBeGreaterThan(27);
  });

  it("detects foreground changes against a collected RGB background model", () => {
    const background = makeFrame(40, 30, [20, 20, 20, 255]);
    const model = createBackgroundModel([background])!;
    const frame = makeFrame(40, 30, [20, 20, 20, 255]);
    fillRect(frame, 10, 7, 18, 13, [220, 220, 220, 255]);

    const result = analyzeVideoFrameSample(frame, {
      sensitivity: 40,
      edgePrecision: 3,
      inverted: false,
    }, model);

    expect(result).not.toBeNull();
    expect(result!.contour.frameWidth).toBe(40);
    expect(result!.contour.spans.length).toBeGreaterThan(0);
  });
});
