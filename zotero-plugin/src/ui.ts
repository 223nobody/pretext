import { getSelectedReaderPayload } from "./zotero-api";

declare const Zotero: any;

export class PretextReaderPlugin {
  private rootURI: string;
  private menuItemId = "pretext-reader-open-item";
  private toolbarButtonId = "pretext-reader-toolbar-button";

  constructor(options: { rootURI: string }) {
    this.rootURI = options.rootURI;
  }

  async startup() {
    this.registerMenuItem();
    this.registerToolbarButton();
  }

  async destroy() {
    const documentRef = Zotero.getMainWindow?.().document;
    documentRef?.getElementById(this.menuItemId)?.remove();
    documentRef?.getElementById(this.toolbarButtonId)?.remove();
  }

  private registerMenuItem() {
    const documentRef = Zotero.getMainWindow?.().document;
    const menu = documentRef?.getElementById("zotero-itemmenu");
    if (!documentRef || !menu || documentRef.getElementById(this.menuItemId)) {
      return;
    }

    const item = documentRef.createXULElement("menuitem");
    item.id = this.menuItemId;
    item.setAttribute("label", "Open with Pretext Reader");
    item.addEventListener("command", () => {
      void this.openSelectedItem();
    });
    menu.appendChild(item);
  }

  private registerToolbarButton() {
    const documentRef = Zotero.getMainWindow?.().document;
    const toolbar = documentRef?.getElementById("zotero-items-toolbar");
    if (!documentRef || !toolbar || documentRef.getElementById(this.toolbarButtonId)) {
      return;
    }

    const button = documentRef.createXULElement("toolbarbutton");
    button.id = this.toolbarButtonId;
    button.setAttribute("label", "Open with Pretext Reader");
    button.setAttribute("tooltiptext", "Open selected item with Pretext Reader");
    button.setAttribute("class", "zotero-tb-button");
    button.addEventListener("command", () => {
      void this.openSelectedItem();
    });
    toolbar.appendChild(button);
  }

  private async openSelectedItem() {
    const payload = await getSelectedReaderPayload();
    if (!payload) {
      Zotero.alert(null, "Pretext Reader", "No Zotero item is selected.");
      return;
    }

    const encoded = encodeURIComponent(JSON.stringify(payload));
    const url = `${this.rootURI}content/reader.html#payload=${encoded}`;
    Zotero.getMainWindow().openDialog(url, "_blank", "chrome,resizable,centerscreen,width=1100,height=760");
  }
}
