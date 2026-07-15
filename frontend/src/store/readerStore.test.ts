import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  (globalThis as unknown as { document: unknown }).document = {
    documentElement: {},
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
    fontFamily: "Inter, sans-serif",
  });
});

afterEach(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
  delete (globalThis as unknown as { getComputedStyle?: unknown }).getComputedStyle;
  vi.restoreAllMocks();
});

describe("readerStore column limits", () => {
  it("uses the light theme by default", async () => {
    const { useReaderStore } = await import("./readerStore");

    expect(useReaderStore.getState().theme).toBe("light");
  });

  it("uses a compact transparent bubble by default", async () => {
    const { useReaderStore } = await import("./readerStore");

    expect(useReaderStore.getState().bubbleRadius).toBe(40);
  });

  it("clamps column count to the reader maximum", async () => {
    const { MAX_READER_COLUMNS, useReaderStore } = await import("./readerStore");

    useReaderStore.getState().setColumnCount(99);

    expect(MAX_READER_COLUMNS).toBe(2);
    expect(useReaderStore.getState().columnCount).toBe(2);
  });

  it("clamps column count to at least one", async () => {
    const { useReaderStore } = await import("./readerStore");

    useReaderStore.getState().setColumnCount(0);

    expect(useReaderStore.getState().columnCount).toBe(1);
  });
});
