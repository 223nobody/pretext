# Pretext Reader API

Base URL: `http://127.0.0.1:8000/api/v1`

All endpoints return:

```json
{
  "success": true,
  "data": {},
  "warnings": []
}
```

Errors return:

```json
{
  "success": false,
  "error": {
    "code": "EMPTY_CONTENT",
    "message": "No usable text could be extracted"
  }
}
```

## Endpoints

### `GET /health`

Health check.

### `POST /file/upload`

Multipart upload:

- `file`: required binary file
- `options`: optional JSON string, for example `{"max_chars":500000}`

Supported extensions: `.pdf`, `.txt`, `.md`, `.docx`, `.epub`, `.html`, `.htm`, `.tex`.

Validation covers extension allowlist, file size, basic MIME detection, encoding detection, unsafe markup, and empty extracted text.

When `ENABLE_OCR=true`, PDFs that produce no embedded text fall back to Tesseract OCR. Configure the OCR language with `OCR_LANGUAGE`, for example `eng` or `chi_sim`.

### `POST /text/extract`

Extract and sanitize raw text.

```json
{
  "text": "Hello <b>reader</b>",
  "max_chars": 500000
}
```

Response data:

```json
{
  "text": "Hello reader",
  "char_count": 12,
  "preview": "Hello reader",
  "truncated": false,
  "metadata": {
    "source": "text"
  }
}
```

Text extraction rejects unsafe script-like markup with `CONTENT_REJECTED` and returns `EMPTY_CONTENT` when no readable text remains after sanitization. `max_chars` is capped by `MAX_TEXT_CHARS`; when the sanitized text is longer than the cap, `truncated` is `true`.

### `GET /arxiv/{id}`

Fetch ArXiv metadata and abstract through the ArXiv API. If the Atom feed exposes a PDF link, the backend attempts to download the PDF and extract embedded text. If PDF download or extraction fails, `full_text` falls back to the abstract and `full_text_source` is `abstract`; otherwise `full_text_source` is `pdf`.

ArXiv fetch failures are normalized into API errors:

- `ARXIV_TIMEOUT` with HTTP 504 when the ArXiv API exceeds the configured timeout.
- `ARXIV_FETCH_FAILED` with HTTP 502 when the ArXiv API returns an HTTP error, the network request fails, or the Atom feed cannot be parsed.

### `POST /url/fetch`

Fetch and clean readable page text.

```json
{
  "url": "https://example.com/article",
  "options": {
    "max_chars": 300000,
    "timeout_ms": 15000
  }
}
```

URL fetch failures are normalized into API errors:

- `URL_TIMEOUT` with HTTP 504 when the remote page exceeds the configured timeout.
- `URL_FETCH_FAILED` with HTTP 502 when the remote page returns an HTTP error or the network request fails.

### `GET /samples`

List bundled sample articles.

### `GET /samples/{id}`

Return one bundled sample article.

### `DELETE /cache/{key}`

Delete a cached extraction result by key.

### `DELETE /cache`

Remove expired or corrupt cache entries.

## Local Verification

```bash
cd backend
.venv\Scripts\python -m pytest
```

## Configuration

Backend environment variables:

- `APP_NAME`: FastAPI application title.
- `MAX_FILE_SIZE`: upload size limit in bytes. Default: `52428800`.
- `MAX_TEXT_CHARS`: maximum extracted text length. Default: `1000000`.
- `MAX_PREVIEW_CHARS`: preview/excerpt length. Default: `500`.
- `CACHE_TTL`: cache lifetime in seconds. Default: `86400`.
- `CACHE_DIR`: cache storage directory. Docker default: `/app/cache`.
- `UPLOAD_DIR`: uploaded source text storage directory. Docker default: `/app/uploads`.
- `ALLOWED_ORIGINS`: comma-separated CORS origins. Local defaults cover Vite dev on `5173` and Compose frontend on `3000`.
- `ENABLE_OCR`: set to `true` to enable scanned-PDF OCR fallback.
- `OCR_LANGUAGE`: Tesseract language code, such as `eng` or `chi_sim`.
- `URL_FETCH_USER_AGENT`: User-Agent sent by `POST /url/fetch`. Default: `PretextReader/0.1`.
