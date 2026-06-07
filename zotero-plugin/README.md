# Pretext Reader Zotero Plugin

Zotero 7 plugin for opening the currently selected Zotero item in a local Pretext Reader window.

## Current Capabilities

- Manifest and bootstrap lifecycle for Zotero 7.
- Item context menu entry and toolbar button: `Open with Pretext Reader`.
- Local reader page at `addon/content/reader.html`.
- TypeScript source for item extraction, note/abstract fallback, PDF attachment full-text lookup, Pretext integration, and UI registration.
- Cross-platform XPI packaging and `update.json` generation.

## Build

```bash
npm install
npm run build
npm run verify
```

Build outputs:

- `addon/content/reader.js`
- `build/pretext-reader.xpi`
- `build/update.json`

Set final release metadata before a public build:

```bash
set ZOTERO_ADDON_ID=pretext-reader@yourdomain.com
set ZOTERO_HOMEPAGE_URL=https://github.com/yourname/zotero-pretext-reader
set ZOTERO_UPDATE_LINK=https://github.com/yourname/zotero-pretext-reader/releases/latest/download/pretext-reader.xpi
npm run build
```

The build injects those values into the packaged manifest and restores the checked-in development manifest afterwards.

The build and verify scripts use Node-only ZIP handling, so they can run on Windows, macOS, or Linux CI.

## Manual Install Check

1. Open Zotero 7.
2. Open `Tools > Add-ons`.
3. Install `build/pretext-reader.xpi` from file.
4. Restart Zotero if prompted.
5. Select a library item and choose `Open with Pretext Reader` from the context menu or toolbar button.
