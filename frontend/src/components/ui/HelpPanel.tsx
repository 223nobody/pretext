import { Keyboard, X } from "lucide-react";

import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";
import { IconButton } from "./IconButton";

export function HelpPanel() {
  const language = useReaderStore((state) => state.language);
  const isHelpOpen = useReaderStore((state) => state.isHelpOpen);
  const closeHelp = useReaderStore((state) => state.closeHelp);

  if (!isHelpOpen) {
    return null;
  }

  const shortcuts = [
    ["1-4", t(language, "columns")],
    ["[", t(language, "fewerColumns")],
    ["]", t(language, "moreColumns")],
    ["Left", t(language, "previousPage")],
    ["Right", t(language, "nextPage")],
    ["T", t(language, "themeCycle")],
    ["F", t(language, "fullscreen")],
    ["?", t(language, "shortcuts")],
    ["Esc", t(language, "close")],
  ];

  return (
    <div className="help-backdrop" role="dialog" aria-modal="true">
      <section className="help-panel">
        <header>
          <div>
            <Keyboard size={18} />
            <h2>{t(language, "shortcuts")}</h2>
          </div>
          <IconButton icon={X} label={t(language, "close")} onClick={closeHelp} />
        </header>
        <dl>
          {shortcuts.map(([keyName, description]) => (
            <div key={keyName}>
              <dt>{keyName}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
