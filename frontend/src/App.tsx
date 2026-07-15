import { useEffect, useLayoutEffect, useRef } from "react";

import { AppLayout } from "./components/layout/AppLayout";
import { HelpPanel } from "./components/ui/HelpPanel";
import { useKeyboard } from "./hooks/useKeyboard";
import { MAX_READER_COLUMNS, useReaderStore } from "./store/readerStore";

/** Returns a sensible default column count based on available width. */
function columnForWidth(w: number): number {
  if (w < 640) return 1;
  if (w < 1024) return 2;
  if (w < 1440) return 2;
  return MAX_READER_COLUMNS;
}

export default function App() {
  const theme = useReaderStore((state) => state.theme);
  const isFullscreen = useReaderStore((state) => state.isFullscreen);
  const setFullscreen = useReaderStore((state) => state.setFullscreen);
  const columnCount = useReaderStore((state) => state.columnCount);
  const setColumnCount = useReaderStore((state) => state.setColumnCount);
  useKeyboard();

  // ---- theme ----------------------------------------------------------
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // ---- fullscreen -----------------------------------------------------
  useEffect(() => {
    document.body.classList.toggle("fullscreen-reader", isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [setFullscreen]);

  // ---- responsive column count ----------------------------------------
  const initCols = useRef(false);
  useEffect(() => {
    const w = window.innerWidth;
    // Only auto-set on first mount before the user has touched the slider.
    if (!initCols.current && columnCount === 2) {
      initCols.current = true;
      const suggested = columnForWidth(w);
      if (suggested !== 2) setColumnCount(suggested);
    }
  }, [columnCount, setColumnCount]);

  // Clamp to what the viewport can fit when the window resizes.
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const onResize = () => {
      const w = window.innerWidth;
      if (w === lastWidth) return;
      lastWidth = w;
      const maxCols = w < 640 ? 1 : MAX_READER_COLUMNS;
      // Read the live value from the store to avoid stale-closure issues.
      const current = useReaderStore.getState().columnCount;
      if (current > maxCols) setColumnCount(maxCols);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setColumnCount]);

  return (
    <>
      <AppLayout />
      <HelpPanel />
    </>
  );
}
