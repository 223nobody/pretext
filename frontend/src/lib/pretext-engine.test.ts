import { describe, expect, it } from "vitest";

import {
  availableSpansFromObstacles,
  createCompositeMaskContour,
  createEllipseMaskContour,
  createFrameSpanMaskContour,
  createPageEllipseMaskContour,
  createSpanMaskContour,
  pickBestAvailableSpan,
  type LayoutConfig,
} from "./pretext-engine";

describe("createEllipseMaskContour", () => {
  const columnWidth = 400;
  const columnHeight = 600;
  // Ellipse centred at 50% / 50% with a 200px diameter.
  const contour = createEllipseMaskContour(50, 50, 200, columnWidth, columnHeight);

  it("returns the widest span at the vertical centre", () => {
    const span = contour.getMaskedSpan(columnHeight / 2, columnHeight);
    expect(span).not.toBeNull();
    // At the centre the chord equals the full diameter (200px), centred on 200px.
    expect(span!.left).toBeCloseTo(100, 5);
    expect(span!.right).toBeCloseTo(300, 5);
  });

  it("returns null outside the vertical extent of the ellipse", () => {
    // The ellipse spans y ∈ [200, 400]; y = 500 is clear of it.
    expect(contour.getMaskedSpan(500, columnHeight)).toBeNull();
  });

  it("narrows the masked span away from the centre", () => {
    const centre = contour.getMaskedSpan(columnHeight / 2, columnHeight)!;
    const nearEdge = contour.getMaskedSpan(columnHeight / 2 + 90, columnHeight)!;
    const centreWidth = centre.right - centre.left;
    const edgeWidth = nearEdge.right - nearEdge.left;
    expect(edgeWidth).toBeLessThan(centreWidth);
  });

  it("clamps the span to the column bounds", () => {
    const span = contour.getMaskedSpan(columnHeight / 2, columnHeight)!;
    expect(span.left).toBeGreaterThanOrEqual(0);
    expect(span.right).toBeLessThanOrEqual(columnWidth);
  });
});

describe("flow obstacle helpers", () => {
  it("turns blocked spans into available spans and picks the widest gap", () => {
    const available = availableSpansFromObstacles(400, [
      { left: 90, right: 160 },
      { left: 150, right: 220 },
      { left: 300, right: 340 },
    ]);

    expect(available).toEqual([
      { startX: 0, width: 90 },
      { startX: 220, width: 80 },
      { startX: 340, width: 60 },
    ]);
    expect(pickBestAvailableSpan(available)).toEqual({ startX: 0, width: 90 });
  });

  it("maps outline mode to two edge obstacle bands", () => {
    const contour = createSpanMaskContour(
      [{ row: 5, left: 20, right: 80 }],
      100,
      10,
      400,
      200,
      24,
    );

    const spans = contour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 100,
      lineCenterY: 110,
      lineHeight: 20,
      columnWidth: 400,
      columnHeight: 200,
    });

    expect(spans).toHaveLength(2);
    expect(spans[0]).toEqual({ left: 80, right: 104 });
    expect(spans[1]).toEqual({ left: 300, right: 324 });
  });

  it("projects a page-level ellipse into the intersecting column only", () => {
    const config: LayoutConfig = {
      columnCount: 2,
      columnWidth: 200,
      columnHeight: 400,
      columnGap: 40,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "serif",
      pagePaddingX: 20,
      pagePaddingY: 20,
    };
    const contour = createPageEllipseMaskContour(75, 50, 120, config);

    const leftColumn = contour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 190,
      lineCenterY: 200,
      lineHeight: 24,
      columnWidth: 200,
      columnHeight: 400,
    });
    const rightColumn = contour.getObstacleSpans!({
      columnIndex: 1,
      lineTop: 190,
      lineCenterY: 200,
      lineHeight: 24,
      columnWidth: 200,
      columnHeight: 400,
    });

    expect(leftColumn).toEqual([]);
    expect(rightColumn.length).toBeGreaterThan(0);
  });

  it("combines multiple obstacle contours for one layout query", () => {
    const left = createEllipseMaskContour(25, 50, 80, 400, 400);
    const right = createEllipseMaskContour(75, 50, 80, 400, 400);
    const contour = createCompositeMaskContour([left, right]);

    const spans = contour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 190,
      lineCenterY: 200,
      lineHeight: 24,
      columnWidth: 400,
      columnHeight: 400,
    });

    expect(spans).toHaveLength(2);
    expect(spans[0].left).toBeLessThan(120);
    expect(spans[1].right).toBeGreaterThan(280);
  });

  it("turns a page-level cursor ellipse into narrowed available line spans", () => {
    const config: LayoutConfig = {
      columnCount: 1,
      columnWidth: 320,
      columnHeight: 420,
      columnGap: 40,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "serif",
      pagePaddingX: 24,
      pagePaddingY: 24,
    };
    const cursorContour = createPageEllipseMaskContour(50, 50, 140, config);
    const lineHeightPx = config.fontSize * config.lineHeight;
    const obstacleSpans = cursorContour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 180,
      lineCenterY: 180 + lineHeightPx / 2,
      lineHeight: lineHeightPx,
      columnWidth: config.columnWidth,
      columnHeight: config.columnHeight,
    });
    const bestSpan = pickBestAvailableSpan(
      availableSpansFromObstacles(config.columnWidth, obstacleSpans),
    );

    expect(obstacleSpans.length).toBeGreaterThan(0);
    expect(bestSpan.width).toBeLessThan(config.columnWidth);
  });

  it("can restrict a page-level ellipse to the active page only", () => {
    const config: LayoutConfig = {
      columnCount: 2,
      columnWidth: 220,
      columnHeight: 420,
      columnGap: 40,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "serif",
      pagePaddingX: 24,
      pagePaddingY: 24,
    };
    const cursorContour = createPageEllipseMaskContour(50, 50, 160, config, 1);
    const lineHeightPx = config.fontSize * config.lineHeight;
    const firstPage = cursorContour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 180,
      lineCenterY: 180 + lineHeightPx / 2,
      lineHeight: lineHeightPx,
      columnWidth: config.columnWidth,
      columnHeight: config.columnHeight,
    });
    const secondPage = cursorContour.getObstacleSpans!({
      columnIndex: 2,
      lineTop: 180,
      lineCenterY: 180 + lineHeightPx / 2,
      lineHeight: lineHeightPx,
      columnWidth: config.columnWidth,
      columnHeight: config.columnHeight,
    });

    expect(firstPage).toEqual([]);
    expect(secondPage.length).toBeGreaterThan(0);
  });

  it("maps video frame spans through object-fit contain geometry", () => {
    const config: LayoutConfig = {
      columnCount: 1,
      columnWidth: 320,
      columnHeight: 520,
      columnGap: 40,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "serif",
      pagePaddingX: 20,
      pagePaddingY: 20,
    };
    const contour = createFrameSpanMaskContour(
      [{ row: 50, left: 20, right: 80 }],
      100,
      100,
      config,
    );

    const outside = contour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 0,
      lineCenterY: 12,
      lineHeight: 24,
      columnWidth: 320,
      columnHeight: 520,
    });
    const inside = contour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 250,
      lineCenterY: 262,
      lineHeight: 24,
      columnWidth: 320,
      columnHeight: 520,
    });

    expect(outside).toEqual([]);
    expect(inside.length).toBeGreaterThan(0);
  });

  it("adds readable padding around projected video spans", () => {
    const config: LayoutConfig = {
      columnCount: 1,
      columnWidth: 320,
      columnHeight: 520,
      columnGap: 40,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "serif",
      pagePaddingX: 20,
      pagePaddingY: 20,
    };
    const contour = createFrameSpanMaskContour(
      [{ row: 50, left: 20, right: 80 }],
      100,
      100,
      config,
    );

    const spans = contour.getObstacleSpans!({
      columnIndex: 0,
      lineTop: 250,
      lineCenterY: 262,
      lineHeight: 24,
      columnWidth: 320,
      columnHeight: 520,
    });

    expect(spans).toHaveLength(1);
    expect(spans[0].left).toBeLessThan(45);
    expect(spans[0].right).toBeGreaterThan(280);
  });
});
