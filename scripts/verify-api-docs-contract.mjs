import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function fail(message) {
  throw new Error(message);
}

const apiDoc = read("docs/API.md");
const readme = read("README.md");
const routes = read("backend/app/api/routes.py");
const fileUpload = read("backend/app/api/file_upload.py");
const textExtract = read("backend/app/api/text_extract.py");
const arxiv = read("backend/app/api/arxiv.py");
const urlFetch = read("backend/app/api/url_fetch.py");
const samples = read("backend/app/api/samples.py");
const cache = read("backend/app/api/cache.py");

const endpoints = [
  {
    doc: "GET /health",
    routeSnippets: ['@api_router.get("/health")'],
    sources: [routes],
  },
  {
    doc: "POST /file/upload",
    routeSnippets: ['api_router.include_router(file_upload.router, prefix="/file"', '@router.post("/upload")'],
    sources: [routes, fileUpload],
  },
  {
    doc: "POST /text/extract",
    routeSnippets: ['api_router.include_router(text_extract.router, prefix="/text"', '@router.post("/extract")'],
    sources: [routes, textExtract],
  },
  {
    doc: "GET /arxiv/{id}",
    routeSnippets: ['api_router.include_router(arxiv.router, prefix="/arxiv"', '@router.get("/{arxiv_id}")'],
    sources: [routes, arxiv],
  },
  {
    doc: "POST /url/fetch",
    routeSnippets: ['api_router.include_router(url_fetch.router, prefix="/url"', '@router.post("/fetch")'],
    sources: [routes, urlFetch],
  },
  {
    doc: "GET /samples",
    routeSnippets: ['api_router.include_router(samples.router, prefix="/samples"', '@router.get("")'],
    sources: [routes, samples],
  },
  {
    doc: "GET /samples/{id}",
    routeSnippets: ['api_router.include_router(samples.router, prefix="/samples"', '@router.get("/{sample_id}")'],
    sources: [routes, samples],
  },
  {
    doc: "DELETE /cache/{key}",
    routeSnippets: ['api_router.include_router(cache.router, prefix="/cache"', '@router.delete("/{key}")'],
    sources: [routes, cache],
  },
  {
    doc: "DELETE /cache",
    routeSnippets: ['api_router.include_router(cache.router, prefix="/cache"', '@router.delete("")'],
    sources: [routes, cache],
  },
];

const missingDocs = endpoints.filter((endpoint) => !apiDoc.includes(`### \`${endpoint.doc}\``)).map((endpoint) => endpoint.doc);
if (missingDocs.length) {
  fail(`docs/API.md is missing documented endpoints:\n${missingDocs.join("\n")}`);
}

const missingRoutes = [];
for (const endpoint of endpoints) {
  for (const snippet of endpoint.routeSnippets) {
    if (!endpoint.sources.some((source) => source.includes(snippet))) {
      missingRoutes.push(`${endpoint.doc}: ${snippet}`);
    }
  }
}
if (missingRoutes.length) {
  fail(`Backend routes do not match documented API endpoints:\n${missingRoutes.join("\n")}`);
}

const readmeCapabilities = ["health", "file upload", "raw text extraction", "URL fetch", "ArXiv fetch", "samples", "cache cleanup"];
const missingReadme = readmeCapabilities.filter((capability) => !readme.includes(capability));
if (missingReadme.length) {
  fail(`README current capabilities are missing API surfaces:\n${missingReadme.join("\n")}`);
}

const responseContractSnippets = ['"success": true', '"data": {}', '"warnings": []', '"success": false', '"error"', '"code"', '"message"'];
const missingResponseContract = responseContractSnippets.filter((snippet) => !apiDoc.includes(snippet));
if (missingResponseContract.length) {
  fail(`docs/API.md is missing response contract snippets:\n${missingResponseContract.join("\n")}`);
}

console.log("API documentation contract checks passed.");
