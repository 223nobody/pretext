import { Maximize2, Minimize2 } from "lucide-react";

import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";
import { IconButton } from "../ui/IconButton";

export function FullscreenButton() {
  const isFullscreen = useReaderStore((state) => state.isFullscreen);
  const toggleFullscreen = useReaderStore((state) => state.toggleFullscreen);
  const language = useReaderStore((state) => state.language);

  return (
    <IconButton
      icon={isFullscreen ? Minimize2 : Maximize2}
      label={t(language, isFullscreen ? "exitFullscreen" : "fullscreen")}
      onClick={toggleFullscreen}
    />
  );
}
