import type { ReaderPayload } from "./types";
import { createCanvasReader, type CanvasReaderAPI } from "./canvas-reader";

let reader: CanvasReaderAPI | null = null;

export async function renderReader(
  payload: ReaderPayload,
  documentRef: Document = document,
): Promise<void> {
  // Update header metadata
  const title = documentRef.getElementById("title");
  const meta = documentRef.getElementById("meta");

  if (title) {
    title.textContent = payload.title || "Untitled item";
  }
  if (meta) {
    const authors = payload.authors.join(", ");
    const sources =
      payload.sources.length > 0
        ? `Sources: ${payload.sources.join(", ")}`
        : "";
    meta.textContent = [authors, sources].filter(Boolean).join(" · ");
  }

  // Render text via Canvas reader
  const container = documentRef.getElementById("reader");
  if (!container) return;

  // Destroy previous reader instance
  if (reader) {
    reader.destroy();
    reader = null;
  }

  // Clear any DOM content (from previous fallback rendering)
  container.innerHTML = "";
  container.style.position = "relative";
  container.style.overflow = "hidden";

  reader = createCanvasReader(container, {
    columnCount: 2,
    columnGap: 42,
    fontSize: 18,
    lineHeight: 1.65,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    theme: "dark",
  });

  reader.render(payload.text);

  // Keyboard shortcuts
  documentRef.addEventListener("keydown", (event) => {
    if (!reader) return;
    const key = event.key;

    if (key >= "1" && key <= "4") {
      reader.setColumns(Number(key));
      reader.render(payload.text);
    }
    if (key === "t" || key === "T") {
      const themes: Array<"dark" | "light" | "sepia"> = ["dark", "light", "sepia"];
      const containerEl = documentRef.getElementById("reader");
      const currentTheme = containerEl?.dataset.theme as "dark" | "light" | "sepia" | undefined;
      const idx = themes.indexOf(currentTheme ?? "dark");
      const next = themes[(idx + 1) % themes.length];
      if (containerEl) containerEl.dataset.theme = next;
      reader.setTheme(next);
    }
    if (key === "[") {
      const currentCols = parseInt((container as HTMLElement).dataset.columns || "2");
      const cols = Math.max(1, currentCols - 1);
      (container as HTMLElement).dataset.columns = String(cols);
      reader.setColumns(cols);
      reader.render(payload.text);
    }
    if (key === "]") {
      const currentCols = parseInt((container as HTMLElement).dataset.columns || "2");
      const cols = Math.min(4, currentCols + 1);
      (container as HTMLElement).dataset.columns = String(cols);
      reader.setColumns(cols);
      reader.render(payload.text);
    }
  });

  // Pointer tracking for bubble cursor
  container.addEventListener("pointermove", (event) => {
    if (!reader) return;
    const rect = container.getBoundingClientRect();
    reader.updateCursor(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  });

  // Resize handling
  const resizeObserver = new ResizeObserver((entries) => {
    if (!reader || entries.length === 0) return;
    const { width, height } = entries[0].contentRect;
    if (width > 0 && height > 0) {
      reader.resize(width, height);
      reader.render(payload.text);
    }
  });
  resizeObserver.observe(container);
}
