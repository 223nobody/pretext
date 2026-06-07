import { useEffect } from "react";

import { AppLayout } from "./components/layout/AppLayout";
import { HelpPanel } from "./components/ui/HelpPanel";
import { useKeyboard } from "./hooks/useKeyboard";
import { useReaderStore } from "./store/readerStore";

export default function App() {
  const theme = useReaderStore((state) => state.theme);
  const isFullscreen = useReaderStore((state) => state.isFullscreen);
  const setFullscreen = useReaderStore((state) => state.setFullscreen);
  useKeyboard();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  return (
    <>
      <AppLayout />
      <HelpPanel />
    </>
  );
}
