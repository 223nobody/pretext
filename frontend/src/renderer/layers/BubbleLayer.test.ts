import { describe, expect, it, vi } from "vitest";

import { drawBubbleLayer } from "./BubbleLayer";

function makeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    ctx: {
      fillStyle: "" as string | CanvasGradient,
      globalCompositeOperation: "source-over" as GlobalCompositeOperation,
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      lineWidth: 1,
      strokeStyle: "",
    } as unknown as CanvasRenderingContext2D,
  };
}

describe("drawBubbleLayer", () => {
  it("does nothing when the radius is zero", () => {
    const { ctx } = makeCtx();
    drawBubbleLayer(ctx, 800, 600, 100, 100, 0, "#f4d35e");
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("does not paint a filled glow or center content", () => {
    const { ctx } = makeCtx();
    drawBubbleLayer(ctx, 800, 600, 100, 100, 80, "#f4d35e");
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("draws a dashed obstacle outline", () => {
    const { ctx } = makeCtx();
    drawBubbleLayer(ctx, 800, 600, 100, 100, 80, "#f4d35e");
    expect(ctx.setLineDash).toHaveBeenCalledWith([3, 5]);
    expect(ctx.arc).toHaveBeenCalledWith(100, 100, 80, 0, Math.PI * 2);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
