import { Check } from "lucide-react";
import type { CSSProperties } from "react";

import { t, type TranslationKey } from "../../lib/i18n";
import { THEMES } from "../../lib/theme";
import { useReaderStore } from "../../store/readerStore";
import type { ThemeName } from "../../types";

const THEME_LABEL_KEYS: Record<ThemeName, TranslationKey> = {
  dark: "themeDark",
  light: "themeLight",
  sepia: "themePaper",
  forest: "themeForest",
  ocean: "themeOcean",
  sunset: "themeSunset",
};

export function ThemeSwitcher() {
  const theme = useReaderStore((state) => state.theme);
  const language = useReaderStore((state) => state.language);
  const setTheme = useReaderStore((state) => state.setTheme);

  return (
    <div className="theme-grid">
      {THEMES.map((item) => {
        const label = t(language, THEME_LABEL_KEYS[item.name]);

        return (
          <button
            key={item.name}
            className="theme-swatch"
            type="button"
            title={label}
            aria-label={label}
            onClick={() => setTheme(item.name)}
            style={{ "--swatch": item.swatch } as CSSProperties}
          >
            <span />
            {theme === item.name ? <Check size={14} /> : null}
          </button>
        );
      })}
    </div>
  );
}
