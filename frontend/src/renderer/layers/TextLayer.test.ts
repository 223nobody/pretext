import { describe, expect, it, vi } from "vitest";

import { drawTextLayer } from "./TextLayer";
import type { TextLayerConfig, ThemeColors } from "../types";
import type { PageLayoutResult } from "../../lib/pretext-engine";

function makeCtx() {
  return {
    font: "",
    fillStyle: "",
    textBaseline: "",
    globalAlpha: 1,
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: Array.from(text).length * 10,
    })),
  } as unknown as CanvasRenderingContext2D;
}

function makeLayout(): PageLayoutResult {
  return {
    pages: [
      {
        pageIndex: 0,
        columns: [
          {
            columnIndex: 0,
            lines: [
              {
                text: "line one",
                width: 80,
                xOffset: 0,
                yOffset: 0,
                availableWidth: 300,
                start: { segmentIndex: 0, graphemeIndex: 0 },
                end: { segmentIndex: 0, graphemeIndex: 8 },
              },
              {
                text: "line two",
                width: 80,
                xOffset: 24,
                yOffset: 28.8,
                availableWidth: 276,
                start: { segmentIndex: 0, graphemeIndex: 8 },
                end: { segmentIndex: 0, graphemeIndex: 16 },
              },
            ],
            totalHeight: 60,
            overflowed: false,
          },
        ],
      },
    ],
    pageCount: 1,
    totalChars: 16,
    totalLines: 2,
  };
}

function makeConfig(overrides: Partial<TextLayerConfig> = {}): TextLayerConfig {
  return {
    pageLayout: makeLayout(),
    pageIndex: 0,
    columnCount: 1,
    columnWidth: 300,
    columnGap: 40,
    fontSize: 18,
    lineHeight: 1.6,
    fontFamily: "serif",
    pagePaddingX: 28,
    pagePaddingY: 28,
    ...overrides,
  };
}

function makeColors(overrides: Partial<ThemeColors> = {}): ThemeColors {
  return {
    pageBackground: "#ffffff",
    pageText: "#020617",
    pageMuted: "#334155",
    pageAccent: "#1d5fa8",
    accent: "#1d5fa8",
    accentStrong: "#164a86",
    mask: "#1d5fa8",
    maskTintAlpha: 0.06,
    maskGlowAlpha: 0.025,
    videoAlpha: 0.36,
    ...overrides,
  };
}

describe("drawTextLayer", () => {
  it("draws every line on the current page", () => {
    const ctx = makeCtx();
    drawTextLayer(ctx, makeConfig(), makeColors());
    expect((ctx.fillText as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });

  it("draws masked layout lines at their layout-provided x offsets", () => {
    const ctx = makeCtx();
    drawTextLayer(ctx, makeConfig(), makeColors());

    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1]).toBe(28);
    expect(calls[1][1]).toBe(52);
  });

  it("defaults to full opacity when mutedAlpha is undefined", () => {
    const ctx = makeCtx();
    drawTextLayer(ctx, makeConfig(), makeColors());
    // globalAlpha is reset to 1 at the end so it doesn't leak to later draws.
    expect(ctx.globalAlpha).toBe(1);
  });

  it("applies mutedAlpha during the draw and resets it afterward", () => {
    const alphaLog: number[] = [];
    const ctx = makeCtx();
    // Capture the alpha in effect at each fillText call.
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => {
      alphaLog.push(ctx.globalAlpha);
    });
    drawTextLayer(ctx, makeConfig({ mutedAlpha: 0.3 }), makeColors());
    expect(alphaLog.every((a) => a === 0.3)).toBe(true);
    // Reset after drawing.
    expect(ctx.globalAlpha).toBe(1);
  });

  it("clamps mutedAlpha into the [0,1] range", () => {
    const ctx = makeCtx();
    const seen: number[] = [];
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => seen.push(ctx.globalAlpha));
    drawTextLayer(ctx, makeConfig({ mutedAlpha: 5 }), makeColors());
    expect(seen.every((a) => a <= 1)).toBe(true);
  });

  it("renders nothing when the page index is out of range", () => {
    const ctx = makeCtx();
    drawTextLayer(ctx, makeConfig({ pageIndex: 9 }), makeColors());
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("uses solid semantic colors for low-emphasis article roles", () => {
    const ctx = makeCtx();
    const fillStyles: unknown[] = [];
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillStyles.push(ctx.fillStyle);
    });
    const pageLayout = makeLayout();
    pageLayout.pages[0].columns[0].lines[0].role = "author";
    pageLayout.pages[0].columns[0].lines[1].role = "metadata";

    drawTextLayer(ctx, makeConfig({ pageLayout }), makeColors());

    expect(fillStyles).toEqual(["#334155", "#334155"]);
  });
});
