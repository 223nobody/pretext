import type { ReaderPayload } from "./types";

export async function renderReader(payload: ReaderPayload, documentRef: Document = document) {
  try {
    await import("@chenglou/pretext");
  } catch {
    // The standalone reader uses native columns until the full Canvas renderer is bundled.
  }

  const title = documentRef.getElementById("title");
  const meta = documentRef.getElementById("meta");
  const reader = documentRef.getElementById("reader");

  if (title) {
    title.textContent = payload.title || "Untitled item";
  }
  if (meta) {
    const authors = payload.authors.join(", ");
    const sources = payload.sources.length > 0 ? `Sources: ${payload.sources.join(", ")}` : "";
    meta.textContent = [authors, sources].filter(Boolean).join(" · ");
  }
  if (reader) {
    reader.replaceChildren(
      ...payload.text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph) => {
          const element = documentRef.createElement("p");
          element.textContent = paragraph;
          return element;
        }),
    );
  }
}
