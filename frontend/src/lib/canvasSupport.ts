/**
 * Canvas capability detection (NEXT_DEVELOPMENT_PLAN §4.2.3).
 *
 * The reader prefers the Canvas renderer (video background, real bubble
 * highlight, custom cursor) and degrades to the CSS renderer only when the
 * environment cannot give us a working 2D context. Detection is intentionally
 * cheap and synchronous so the store can pick a mode at init.
 */
export function detectCanvasSupport(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    if (typeof canvas.getContext !== "function") {
      return false;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return false;
    }
    // A handful of 2D APIs the renderer relies on must exist.
    return (
      typeof ctx.createRadialGradient === "function" &&
      typeof ctx.fillText === "function" &&
      typeof ctx.drawImage === "function" &&
      typeof ctx.clearRect === "function"
    );
  } catch {
    return false;
  }
}

/**
 * The mode the reader should use by default. Cached so repeated reads don't
 * re-create canvases.
 */
let cachedMode: "canvas" | "css" | null = null;

function normalizeEngineMode(value: string | null | undefined): "canvas" | "css" | null {
  if (value === "canvas" || value === "css") {
    return value;
  }
  return null;
}

function forcedEngineMode(): "canvas" | "css" | null {
  const envMode = normalizeEngineMode(import.meta.env.VITE_FORCE_ENGINE);
  if (envMode) {
    return envMode;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeEngineMode(new URLSearchParams(window.location.search).get("engine"));
  } catch {
    return null;
  }
}

export function defaultEngineMode(): "canvas" | "css" {
  const forcedMode = forcedEngineMode();
  if (forcedMode) {
    return forcedMode;
  }

  if (cachedMode === null) {
    cachedMode = detectCanvasSupport() ? "canvas" : "css";
  }
  return cachedMode;
}
