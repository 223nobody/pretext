import { renderReader } from "./pretext-bridge";
import { PretextReaderPlugin } from "./ui";
import type { ReaderPayload } from "./types";

declare global {
  interface Window {
    Zotero?: {
      PretextReader?: typeof PretextReaderPlugin;
    };
  }
}

if (typeof window !== "undefined") {
  if (window.Zotero) {
    window.Zotero.PretextReader = PretextReaderPlugin;
  }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const encodedPayload = hash.get("payload");
  if (encodedPayload) {
    try {
      const payload = JSON.parse(decodeURIComponent(encodedPayload)) as ReaderPayload;
      void renderReader(payload);
    } catch {
      void renderReader({
        title: "Pretext Reader",
        authors: [],
        sources: [],
        text: "The selected Zotero item could not be loaded.",
      });
    }
  }
}
