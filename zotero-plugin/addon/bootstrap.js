var PretextReader;

async function install() {
  Zotero.log("Pretext Reader: installed");
}

async function startup({ rootURI }) {
  Zotero.log("Pretext Reader: starting");
  Services.scriptloader.loadSubScript(rootURI + "content/reader.js");

  PretextReader = new Zotero.PretextReader({ rootURI });
  await PretextReader.startup();

  Zotero.log("Pretext Reader: started");
}

async function shutdown() {
  Zotero.log("Pretext Reader: shutting down");
  if (PretextReader) {
    await PretextReader.destroy();
    PretextReader = null;
  }
}

async function uninstall() {
  Zotero.log("Pretext Reader: uninstalled");
}
