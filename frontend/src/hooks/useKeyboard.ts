import { useEffect } from "react";

import { THEMES } from "../lib/theme";
import { useReaderStore } from "../store/readerStore";

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export function useKeyboard() {
  const columnCount = useReaderStore((state) => state.columnCount);
  const setColumnCount = useReaderStore((state) => state.setColumnCount);
  const theme = useReaderStore((state) => state.theme);
  const setTheme = useReaderStore((state) => state.setTheme);
  const toggleFullscreen = useReaderStore((state) => state.toggleFullscreen);
  const toggleHelp = useReaderStore((state) => state.toggleHelp);
  const closeHelp = useReaderStore((state) => state.closeHelp);
  const nextPage = useReaderStore((state) => state.nextPage);
  const previousPage = useReaderStore((state) => state.previousPage);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target)) {
        return;
      }
      if (event.key >= "1" && event.key <= "4") {
        setColumnCount(Number(event.key));
      }
      if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
      if (event.key.toLowerCase() === "t") {
        const index = THEMES.findIndex((item) => item.name === theme);
        setTheme(THEMES[(index + 1) % THEMES.length].name);
      }
      if (event.key === "[" || event.key === "]") {
        const next = event.key === "[" ? Math.max(1, columnCount - 1) : Math.min(4, columnCount + 1);
        setColumnCount(next);
      }
      if (event.key === "?") {
        toggleHelp();
      }
      if (event.key === "Escape") {
        closeHelp();
      }
      if (event.key === "ArrowLeft") {
        previousPage();
      }
      if (event.key === "ArrowRight") {
        nextPage();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeHelp, columnCount, nextPage, previousPage, setColumnCount, setTheme, theme, toggleFullscreen, toggleHelp]);
}
