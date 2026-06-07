# Zotero Plugin Submission

The current plugin package is under `zotero-plugin/`.

## Build

```bash
cd zotero-plugin
npm install
npm run build
npm run verify
```

Build outputs:

- `addon/content/reader.js`
- `build/pretext-reader.xpi`
- `build/update.json` with a `sha256:` update hash

## Manual Install Check

1. Open Zotero 7.
2. Go to `Tools > Add-ons`.
3. Choose install from file.
4. Select `zotero-plugin/build/pretext-reader.xpi`.
5. Restart Zotero if prompted.
6. Select an item and use the item context menu entry `Open with Pretext Reader`.

## Marketplace Metadata

Target repository: `syt2/zotero-addons-scraper`.

Proposed addon file:

```yaml
repo: yourname/zotero-pretext-reader
releases:
  - targetZoteroVersion: "7"
    tagName: latest
```

Before submitting, replace placeholder URLs in:

- `zotero-plugin/addon/manifest.json`
- `zotero-plugin/zotero-plugin.config.ts`
- `docs/PLUGIN_SUBMISSION.md` marketplace YAML examples

Build the public XPI and `update.json` with final release metadata:

```bash
set ZOTERO_ADDON_ID=pretext-reader@yourdomain.com
set ZOTERO_HOMEPAGE_URL=https://github.com/yourname/zotero-pretext-reader
set ZOTERO_UPDATE_LINK=https://github.com/yourname/zotero-pretext-reader/releases/latest/download/pretext-reader.xpi
npm run build
npm run verify
```

The build script injects `ZOTERO_ADDON_ID` and `ZOTERO_HOMEPAGE_URL` into the packaged manifest, then restores the checked-in development manifest. The `applications.zotero.id` must remain unique and stable across releases.

The checked-in `example.local` and `yourname/zotero-pretext-reader` values are development placeholders. A public release must use a real homepage, repository slug, stable Zotero add-on id, and final `ZOTERO_UPDATE_LINK` before packaging the XPI.
