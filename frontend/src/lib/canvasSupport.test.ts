import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEngineMode, detectCanvasSupport } from "./canvasSupport";

/**
 * detectCanvasSupport probes `document.createElement("canvas")`. The Node test
 * environment has no DOM, so each test installs a minimal fake `document` and
 * removes it afterwards.
 */

type CtxOverrides = Record<string, unknown>;

function makeCtx(overrides: CtxOverrides = {}): CtxOverrides {
  return {
    createRadialGradient: () => ({}),
    fillText: () => {},
    drawImage: () => {},
    clearRect: () => {},
    ...overrides,
  };
}

function installDocument(getContext: () => unknown): void {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ getContext }),
  };
}

afterEach(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
  delete (globalThis as unknown as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe("detectCanvasSupport", () => {
  it("returns true when a 2D context exposes the required APIs", () => {
    installDocument(() => makeCtx());
    expect(detectCanvasSupport()).toBe(true);
  });

  it("returns false when getContext yields null", () => {
    installDocument(() => null);
    expect(detectCanvasSupport()).toBe(false);
  });

  it("returns false when a required 2D API is missing", () => {
    installDocument(() => makeCtx({ createRadialGradient: undefined }));
    expect(detectCanvasSupport()).toBe(false);
  });

  it("returns false when getContext throws", () => {
    installDocument(() => {
      throw new Error("no context");
    });
    expect(detectCanvasSupport()).toBe(false);
  });

  it("returns false when there is no document (SSR / worker)", () => {
    delete (globalThis as unknown as { document?: unknown }).document;
    expect(detectCanvasSupport()).toBe(false);
  });
});

describe("defaultEngineMode", () => {
  it("allows forcing CSS mode through the URL query string", () => {
    (globalThis as unknown as { window: unknown }).window = {
      location: { search: "?engine=css" },
    };

    expect(defaultEngineMode()).toBe("css");
  });

  it("allows forcing Canvas mode through the URL query string", () => {
    (globalThis as unknown as { window: unknown }).window = {
      location: { search: "?engine=canvas" },
    };

    expect(defaultEngineMode()).toBe("canvas");
  });
});
