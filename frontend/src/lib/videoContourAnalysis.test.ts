import { describe, expect, it } from "vitest";

import {
  analyzeContour,
  connectedComponents,
  dilate,
  extractSpans,
  pickDominant,
  sobelMagnitude,
  threshold,
  toGrayscale,
  type BinaryField,
} from "./videoContourAnalysis";

/** Builds an RGBA buffer from a grayscale value grid (row-major). */
function rgbaFromGray(values: number[], width: number, height: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = values[i];
    buf[i * 4 + 1] = values[i];
    buf[i * 4 + 2] = values[i];
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

function binary(data: number[], width: number, height: number): BinaryField {
  return { data: Uint8Array.from(data), width, height };
}

describe("toGrayscale", () => {
  it("applies Rec.601 luminance weights", () => {
    // Pure red, green, blue pixels.
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
    const gray = toGrayscale(rgba, 3, 1);
    expect(gray.data[0]).toBeCloseTo(0.299 * 255, 3);
    expect(gray.data[1]).toBeCloseTo(0.587 * 255, 3);
    expect(gray.data[2]).toBeCloseTo(0.114 * 255, 3);
  });
});

describe("sobelMagnitude", () => {
  it("responds to a vertical edge and is zero on flat fields", () => {
    // 4x3 field: left half black, right half white → strong edge in the middle.
    const w = 4;
    const h = 3;
    const vals = [
      0, 0, 255, 255,
      0, 0, 255, 255,
      0, 0, 255, 255,
    ];
    const gray = toGrayscale(rgbaFromGray(vals, w, h), w, h);
    const edges = sobelMagnitude(gray);
    // Interior pixel straddling the edge (x=1 or x=2, y=1) should be non-zero.
    expect(edges.data[1 * w + 1]).toBeGreaterThan(0);

    // A completely flat field yields zero everywhere.
    const flat = toGrayscale(rgbaFromGray(new Array(w * h).fill(120), w, h), w, h);
    const flatEdges = sobelMagnitude(flat);
    expect(flatEdges.data.every((v) => v === 0)).toBe(true);
  });
});

describe("threshold", () => {
  it("keeps values >= the threshold", () => {
    const field = { data: Float32Array.from([10, 50, 100, 200]), width: 4, height: 1 };
    const out = threshold(field, 100);
    expect(Array.from(out.data)).toEqual([0, 0, 1, 1]);
  });

  it("inverts to keep values below the threshold", () => {
    const field = { data: Float32Array.from([10, 50, 100, 200]), width: 4, height: 1 };
    const out = threshold(field, 100, true);
    expect(Array.from(out.data)).toEqual([1, 1, 0, 0]);
  });
});

describe("dilate", () => {
  it("grows a single pixel into a square neighbourhood", () => {
    // 5x5 with a single on-pixel at the centre.
    const data = new Array(25).fill(0);
    data[2 * 5 + 2] = 1;
    const out = dilate(binary(data, 5, 5), 1);
    // The 3x3 block around the centre should now be filled.
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(out.data[y * 5 + x]).toBe(1);
      }
    }
    // Corners of the frame remain off.
    expect(out.data[0]).toBe(0);
  });

  it("is a no-op at radius 0", () => {
    const data = [0, 1, 0, 0];
    const out = dilate(binary(data, 4, 1), 0);
    expect(Array.from(out.data)).toEqual(data);
  });
});

describe("connectedComponents", () => {
  it("labels two disjoint blobs separately", () => {
    // 5x1: two runs separated by a gap.
    const field = binary([1, 1, 0, 1, 1], 5, 1);
    const { components } = connectedComponents(field);
    expect(components).toHaveLength(2);
    expect(components[0].pixels).toBe(2);
    expect(components[1].pixels).toBe(2);
  });

  it("merges 4-connected pixels into one component", () => {
    // 3x3 plus-shape.
    const field = binary([0, 1, 0, 1, 1, 1, 0, 1, 0], 3, 3);
    const { components } = connectedComponents(field);
    expect(components).toHaveLength(1);
    expect(components[0].pixels).toBe(5);
  });
});

describe("pickDominant", () => {
  it("prefers the larger component", () => {
    const field = binary([1, 0, 1, 1], 4, 1);
    const { components } = connectedComponents(field);
    const dom = pickDominant(components, 4, 1);
    expect(dom?.pixels).toBe(2);
  });

  it("returns null with no components", () => {
    expect(pickDominant([], 10, 10)).toBeNull();
  });
});

describe("extractSpans", () => {
  it("returns min-left/max-right per occupied row", () => {
    // 4x2: row 0 occupies x1..x3, row 1 empty.
    const labels = Int32Array.from([0, 7, 7, 7, 0, 0, 0, 0]);
    const spans = extractSpans(labels, 4, 2, 7);
    expect(spans).toEqual([{ row: 0, left: 1, right: 3 }]);
  });
});

describe("analyzeContour", () => {
  it("finds a bright square on a dark background", () => {
    const w = 20;
    const h = 20;
    const vals = new Array(w * h).fill(0);
    // A 8x8 bright block near the centre.
    for (let y = 6; y < 14; y++) {
      for (let x = 6; x < 14; x++) {
        vals[y * w + x] = 255;
      }
    }
    const result = analyzeContour(rgbaFromGray(vals, w, h), w, h, {
      sensitivity: 40,
      edgePrecision: 4,
      inverted: false,
    });
    expect(result).not.toBeNull();
    // The detected region should sit around the block.
    expect(result!.bounds.minX).toBeLessThanOrEqual(8);
    expect(result!.bounds.maxX).toBeGreaterThanOrEqual(11);
    expect(result!.spans.length).toBeGreaterThan(0);
  });

  it("returns null on a flat frame (nothing to detect)", () => {
    const w = 20;
    const h = 20;
    const vals = new Array(w * h).fill(128);
    const result = analyzeContour(rgbaFromGray(vals, w, h), w, h, {
      sensitivity: 40,
      edgePrecision: 4,
      inverted: false,
    });
    expect(result).toBeNull();
  });
});
