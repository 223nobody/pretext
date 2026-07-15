import { afterEach, describe, expect, it, vi } from "vitest";

import { createCanvasRenderer } from "./CanvasRenderer";

type MockContext = {
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  createLinearGradient: ReturnType<typeof vi.fn>;
  createRadialGradient: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  textBaseline: string;
  font: string;
  globalAlpha: number;
  globalCompositeOperation: string;
};

function makeGradient() {
  return { addColorStop: vi.fn() };
}

function makeContext(): MockContext {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => makeGradient()),
    createRadialGradient: vi.fn(() => makeGradient()),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    textBaseline: "",
    font: "",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
  };
}

describe("createCanvasRenderer", () => {
  afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { getComputedStyle?: unknown }).getComputedStyle;
    vi.restoreAllMocks();
  });

  it("uses the latest dimensions after resize", () => {
    const contexts: MockContext[] = [];
    const appended: unknown[] = [];

    (globalThis as unknown as { window: unknown }).window = { devicePixelRatio: 2 };
    (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
      getPropertyValue: (name: string) => {
        if (name === "--page") return "#111827";
        if (name === "--page-text") return "#e2e8f0";
        if (name === "--accent") return "#60a5fa";
        if (name === "--accent-strong") return "#3b82f6";
        return "";
      },
    });
    (globalThis as unknown as { document: unknown }).document = {
      createElement: () => {
        const ctx = makeContext();
        contexts.push(ctx);
        return {
          style: {},
          width: 0,
          height: 0,
          setAttribute: vi.fn(),
          getContext: vi.fn(() => ctx),
          remove: vi.fn(),
        };
      },
    };

    const container = {
      appendChild: vi.fn((child: unknown) => {
        appended.push(child);
      }),
    };

    const renderer = createCanvasRenderer({
      container: container as unknown as HTMLElement,
      width: 100,
      height: 50,
      devicePixelRatio: 1,
    });

    renderer.resize(240, 120);

    const backgroundContext = contexts[0];
    expect(backgroundContext.clearRect).toHaveBeenLastCalledWith(0, 0, 240, 120);
    expect(backgroundContext.fillRect).toHaveBeenLastCalledWith(0, 0, 240, 120);
    expect(backgroundContext.scale).toHaveBeenLastCalledWith(2, 2);
    expect(appended).toHaveLength(4);
  });
});
