import { useEffect, useState } from "react";

import { layoutText } from "../lib/pretext-engine";

export function usePretext(text: string, columnCount: number, fontSize: number, lineHeight: number) {
  const [laidOutText, setLaidOutText] = useState(text);

  useEffect(() => {
    let cancelled = false;
    layoutText({ text, columnCount, fontSize, lineHeight }).then((result) => {
      if (!cancelled) {
        setLaidOutText(result.text);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [columnCount, fontSize, lineHeight, text]);

  return laidOutText;
}
