# Pretext Reader

Full-stack reader built from `DEVELOPMENT_DOC.md`: FastAPI backend, React/Vite frontend, and a Zotero 7 plugin package.

## Current Capabilities

- FastAPI API under `/api/v1` with health, file upload, raw text extraction, URL fetch, ArXiv fetch, samples, and cache cleanup endpoints.
- File validation for extension, size, MIME warnings, encoding detection, unsafe markup, and empty content.
- Text extraction for PDF, TXT, Markdown, HTML, DOCX, EPUB, and LaTeX. Optional OCR is available for scanned PDFs through Tesseract.
- ArXiv fetching with metadata, PDF download/extraction when available, and abstract fallback.
- React reader with sidebar content sources for pasted text, drag-and-drop upload, samples, ArXiv, and URL loading, plus six themes, adjustable columns/column gap/font/line height, progress, keyboard shortcuts, fullscreen mode, custom cursor uploads (PNG/GIF/APNG/WebP/WebM), and background-video text avoidance.
- Zotero 7 plugin source, local reader page, XPI packaging, `update.json` generation, and package verification.
- Docker Compose deployment with persistent backend cache/uploads, backend and frontend healthchecks, nginx SPA fallback, and static asset caching.

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

If Vite starts on `5174` because `5173` is already in use, restart the old frontend process or make sure `ALLOWED_ORIGINS` includes `http://127.0.0.1:5174`.

## Verification

Run the main verification suite:

```bash
npm run verify
```

This runs frontend source checks, upload/input/API-error contract checks, backend tests, frontend production build, Zotero plugin build, and XPI package verification.

Run the Docker Compose configuration check:

```bash
npm run verify:docker
```

Run the full Docker image build check when Docker Desktop or a Docker daemon is running:

```bash
npm run verify:docker:build
```

## Zotero Plugin

```bash
cd zotero-plugin
npm install
npm run build
npm run verify
```

Build outputs:

- `zotero-plugin/addon/content/reader.js`
- `zotero-plugin/build/pretext-reader.xpi`
- `zotero-plugin/build/update.json`

Before a public release, set the final update URL:

```bash
set ZOTERO_UPDATE_LINK=https://github.com/yourname/zotero-pretext-reader/releases/latest/download/pretext-reader.xpi
```

Replace the development placeholder homepage, repository slug, and Zotero add-on id before publishing.

## Environment

Copy `.env.example` and adjust values for your deployment.

Useful backend variables:

- `MAX_FILE_SIZE`
- `MAX_TEXT_CHARS`
- `MAX_PREVIEW_CHARS`
- `CACHE_TTL`
- `CACHE_DIR`
- `UPLOAD_DIR`
- `ALLOWED_ORIGINS`
- `ENABLE_OCR`
- `OCR_LANGUAGE`
- `URL_FETCH_USER_AGENT`

Useful frontend variables:

- `VITE_API_URL`
- `VITE_APP_NAME`
- `VITE_DEFAULT_THEME`

For local Vite development, include both `http://127.0.0.1:5173` and `http://127.0.0.1:5174` in `ALLOWED_ORIGINS` if you sometimes run multiple dev servers.

Optional OCR:

```bash
set ENABLE_OCR=true
set OCR_LANGUAGE=eng
```

When enabled, scanned PDFs fall back to Tesseract OCR if regular text extraction returns empty text. Tesseract must be installed on the machine.

## Docker Compose Notes

`docker-compose.yml` persists backend cache and uploaded source text through `./cache:/app/cache` and `./uploads:/app/uploads`. Keep `CACHE_DIR=/app/cache` and `UPLOAD_DIR=/app/uploads` aligned with those mounts when overriding environment variables.

The backend service uses `/api/v1/health` as its Compose healthcheck, and the frontend service uses `/healthz`, so `docker compose ps` should show both services as healthy after startup.

The backend Docker image defaults to the same `/app/cache` and `/app/uploads` paths even when it is run outside Compose.

The frontend container serves the Vite build through nginx with SPA fallback enabled. `/healthz` returns `ok` for simple reverse-proxy or container checks, and hashed `/assets/` files are served with long-lived immutable caching.

## Baota Panel Deployment

For Baota panel deployment, use Docker Compose for the frontend/backend containers and Baota Nginx as the public HTTPS reverse proxy.

Recommended production frontend API setting:

```bash
VITE_API_URL=/api/v1
```

Then configure Baota Nginx so `/api/` proxies to `http://127.0.0.1:8000` and `/` proxies to `http://127.0.0.1:3000`.

See [docs/BT_PANEL_DEPLOYMENT.md](docs/BT_PANEL_DEPLOYMENT.md) for the full checklist and Nginx config.
