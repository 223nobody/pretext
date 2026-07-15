/**
 * Video contour analysis (NEXT_DEVELOPMENT_PLAN §5.1).
 *
 * Upgrades the old brightness/contrast blob detector into a proper edge +
 * region pipeline:
 *
 *   grayscale → Sobel edge magnitude → threshold → morphological dilation →
 *   connected-component analysis → largest region → per-row spans.
 *
 * The per-row spans feed the mask-aware Pretext layout so text flows around the
 * detected subject's actual silhouette instead of a fixed ellipse.
 *
 * Everything here is pure (operates on plain typed arrays), so it is unit
 * testable without a DOM or a real <video> element.
 */

export interface GrayField {
  data: Float32Array; // 0-255 luminance, row-major
  width: number;
  height: number;
}

export interface BinaryField {
  data: Uint8Array; // 0 or 1, row-major
  width: number;
  height: number;
}

/** One horizontal filled span on a given row, in source-pixel coordinates. */
export interface RowSpan {
  row: number;
  left: number;
  right: number;
}

export interface ContourResult {
  /** Bounding box of the dominant region (source-pixel coords). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Filled extent per row of the dominant region. */
  spans: RowSpan[];
  /** Number of foreground pixels in the dominant region. */
  area: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Grayscale
// ---------------------------------------------------------------------------

/**
 * Converts RGBA pixel data (as from `getImageData`) to a luminance field using
 * the Rec. 601 weights.
 */
export function toGrayscale(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayField {
  const data = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    data[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { data, width, height };
}

// ---------------------------------------------------------------------------
// Sobel edge detection
// ---------------------------------------------------------------------------

/**
 * Computes the Sobel gradient magnitude for a grayscale field. Border pixels
 * are treated as 0 (no wrap). Returns a field of magnitudes (unbounded, but
 * typically 0-1442 for 8-bit input).
 */
export function sobelMagnitude(gray: GrayField): GrayField {
  const { data, width, height } = gray;
  const out = new Float32Array(width * height);

  const at = (x: number, y: number) => data[y * width + x];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = at(x - 1, y - 1);
      const tc = at(x, y - 1);
      const tr = at(x + 1, y - 1);
      const ml = at(x - 1, y);
      const mr = at(x + 1, y);
      const bl = at(x - 1, y + 1);
      const bc = at(x, y + 1);
      const br = at(x + 1, y + 1);

      const gx = tl + 2 * ml + bl - (tr + 2 * mr + br);
      const gy = tl + 2 * tc + tr - (bl + 2 * bc + br);

      out[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  return { data: out, width, height };
}

// ---------------------------------------------------------------------------
// Thresholding
// ---------------------------------------------------------------------------

/**
 * Thresholds a field into a binary mask. `threshold` is compared with `>=`.
 * When `invert` is set, pixels BELOW the threshold become foreground — used for
 * the "dark subject on bright background" case.
 */
export function threshold(field: GrayField, value: number, invert = false): BinaryField {
  const { data, width, height } = field;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const on = invert ? data[i] < value : data[i] >= value;
    out[i] = on ? 1 : 0;
  }
  return { data: out, width, height };
}

// ---------------------------------------------------------------------------
// Morphological dilation (square structuring element)
// ---------------------------------------------------------------------------

/**
 * Dilates a binary field by `radius` using a square structuring element,
 * implemented as two separable 1-D passes for O(n·radius) cost. `radius` maps
 * from the UI's edge-precision control (see NEXT_DEVELOPMENT_PLAN §5.1.2).
 */
export function dilate(field: BinaryField, radius: number): BinaryField {
  if (radius <= 0) {
    return { data: field.data.slice(), width: field.width, height: field.height };
  }
  const { width, height } = field;
  const r = Math.floor(radius);

  // Horizontal pass.
  const horiz = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let dx = -r; dx <= r && !on; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width && field.data[y * width + nx]) on = 1;
      }
      horiz[y * width + x] = on;
    }
  }

  // Vertical pass.
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let dy = -r; dy <= r && !on; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height && horiz[ny * width + x]) on = 1;
      }
      out[y * width + x] = on;
    }
  }

  return { data: out, width, height };
}

// ---------------------------------------------------------------------------
// Connected-component analysis (4-connectivity, iterative flood fill)
// ---------------------------------------------------------------------------

interface Component {
  pixels: number; // count
  label: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Labels 4-connected foreground components and returns the label field plus
 * per-component stats. Uses an explicit stack (no recursion) so large frames
 * don't overflow.
 */
export function connectedComponents(field: BinaryField): { labels: Int32Array; components: Component[] } {
  const { data, width, height } = field;
  const labels = new Int32Array(width * height).fill(0);
  const components: Component[] = [];
  const stack: number[] = [];
  let nextLabel = 0;

  for (let start = 0; start < data.length; start++) {
    if (!data[start] || labels[start] !== 0) continue;

    nextLabel++;
    const comp: Component = {
      pixels: 0,
      label: nextLabel,
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
    };

    stack.length = 0;
    stack.push(start);
    labels[start] = nextLabel;

    while (stack.length > 0) {
      const idx = stack.pop() as number;
      const x = idx % width;
      const y = (idx - x) / width;

      comp.pixels++;
      if (x < comp.minX) comp.minX = x;
      if (x > comp.maxX) comp.maxX = x;
      if (y < comp.minY) comp.minY = y;
      if (y > comp.maxY) comp.maxY = y;

      // 4-neighbours
      if (x > 0) {
        const n = idx - 1;
        if (data[n] && labels[n] === 0) {
          labels[n] = nextLabel;
          stack.push(n);
        }
      }
      if (x < width - 1) {
        const n = idx + 1;
        if (data[n] && labels[n] === 0) {
          labels[n] = nextLabel;
          stack.push(n);
        }
      }
      if (y > 0) {
        const n = idx - width;
        if (data[n] && labels[n] === 0) {
          labels[n] = nextLabel;
          stack.push(n);
        }
      }
      if (y < height - 1) {
        const n = idx + width;
        if (data[n] && labels[n] === 0) {
          labels[n] = nextLabel;
          stack.push(n);
        }
      }
    }

    components.push(comp);
  }

  return { labels, components };
}

/**
 * Picks the "dominant" component. Prefers the largest by pixel area, but breaks
 * near-ties (within 20%) toward the one closest to the frame centre so a subject
 * that is slightly smaller than a background blob is still chosen.
 */
export function pickDominant(
  components: Component[],
  width: number,
  height: number,
): Component | null {
  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => b.pixels - a.pixels);
  const largest = sorted[0];
  const cx = width / 2;
  const cy = height / 2;

  const dist = (c: Component) => {
    const mx = (c.minX + c.maxX) / 2;
    const my = (c.minY + c.maxY) / 2;
    return Math.hypot(mx - cx, my - cy);
  };

  let best = largest;
  let bestDist = dist(largest);
  for (const c of sorted) {
    if (c.pixels < largest.pixels * 0.8) break; // only near-ties
    const d = dist(c);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Per-row spans of the dominant region
// ---------------------------------------------------------------------------

/**
 * Extracts the filled horizontal extent of `label` on each row it occupies.
 * The result is the outer silhouette (min-left to max-right per row), which is
 * what the "text wraps the outline" mode needs.
 */
export function extractSpans(labels: Int32Array, width: number, height: number, label: number): RowSpan[] {
  const spans: RowSpan[] = [];
  for (let y = 0; y < height; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x++) {
      if (labels[y * width + x] === label) {
        if (left === -1) left = x;
        right = x;
      }
    }
    if (left !== -1) {
      spans.push({ row: y, left, right });
    }
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

export interface ContourOptions {
  /** 10-80 from the UI; higher = stricter edge threshold. */
  sensitivity: number;
  /** 1-10 from the UI; controls dilation radius. */
  edgePrecision: number;
  /** Detect dark subjects on a bright background instead of edges. */
  inverted: boolean;
}

/**
 * Runs the full analysis on an RGBA buffer and returns the dominant region's
 * silhouette, or null if nothing significant was found.
 */
export function analyzeContour(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: ContourOptions,
): ContourResult | null {
  const gray = toGrayscale(rgba, width, height);

  // Sensitivity (10-80) → edge threshold. Higher sensitivity keeps weaker edges.
  const edgeThreshold = 160 - options.sensitivity * 1.6;

  let binary: BinaryField;
  if (options.inverted) {
    // Dark-subject mode: threshold the luminance directly.
    binary = threshold(gray, 40 + options.sensitivity, true);
  } else {
    const edges = sobelMagnitude(gray);
    binary = threshold(edges, Math.max(20, edgeThreshold));
  }

  const dilateRadius = Math.max(1, Math.round(options.edgePrecision / 2));
  const dilated = dilate(binary, dilateRadius);

  const { labels, components } = connectedComponents(dilated);
  const dominant = pickDominant(components, width, height);

  // Require a minimum footprint (~1.5% of the frame) to avoid noise locking on.
  const minArea = Math.max(12, width * height * 0.015);
  if (!dominant || dominant.pixels < minArea) {
    return null;
  }

  const spans = extractSpans(labels, width, height, dominant.label);

  return {
    bounds: {
      minX: dominant.minX,
      minY: dominant.minY,
      maxX: dominant.maxX,
      maxY: dominant.maxY,
    },
    spans,
    area: dominant.pixels,
    width,
    height,
  };
}
