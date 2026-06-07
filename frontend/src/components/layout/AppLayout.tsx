import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { ReaderArea } from "./ReaderArea";
import { Sidebar } from "./Sidebar";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";

export function AppLayout() {
  const isSidebarOpen = useReaderStore((state) => state.isSidebarOpen);
  const language = useReaderStore((state) => state.language);
  const toggleSidebar = useReaderStore((state) => state.toggleSidebar);

  return (
    <main className="app-shell">
      {isSidebarOpen ? <Sidebar /> : null}
      <IconButton
        className="sidebar-toggle"
        icon={isSidebarOpen ? PanelLeftClose : PanelLeftOpen}
        label={t(language, isSidebarOpen ? "hidePanel" : "showPanel")}
        onClick={toggleSidebar}
      />
      <ReaderArea />
    </main>
  );
}
