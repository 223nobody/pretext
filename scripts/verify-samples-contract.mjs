import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function loadSamples() {
  const source = read("backend/app/services/samples_data.py");
  const match = source.match(/SAMPLES\s*=\s*(\[[\s\S]*\])\s*$/);
  if (!match) {
    fail("Could not find SAMPLES in backend/app/services/samples_data.py.");
  }
  const entries = match[1].match(/\{\s*"id":[\s\S]*?\n    \}/g) ?? [];
  return entries.map((entry) => {
    const sample = {};
    for (const field of ["id", "title", "author", "category"]) {
      const fieldMatch = entry.match(new RegExp(`"${field}":\\s*"([^"]+)"`));
      if (fieldMatch) {
        sample[field] = fieldMatch[1];
      }
    }
    const textMatch = entry.match(/"text":\s*\(([\s\S]*?)\n        \),/);
    if (textMatch) {
      sample.text = [...textMatch[1].matchAll(/"([^"]*)"/g)].map((part) => part[1]).join("");
    }
    return sample;
  });
}

const samples = loadSamples();
if (!Array.isArray(samples)) {
  fail("SAMPLES must be a list.");
}
if (samples.length < 3 || samples.length > 5) {
  fail(`Development doc requires 3-5 sample articles, found ${samples.length}.`);
}

const ids = new Set();
const categories = new Set();
const missing = [];
for (const sample of samples) {
  for (const field of ["id", "title", "author", "category", "text"]) {
    if (typeof sample[field] !== "string" || !sample[field].trim()) {
      missing.push(`${sample.id ?? "<missing id>"}: ${field}`);
    }
  }
  if (ids.has(sample.id)) {
    fail(`Sample ids must be unique, duplicate found: ${sample.id}`);
  }
  ids.add(sample.id);
  categories.add(sample.category);
  if (typeof sample.text === "string" && sample.text.trim().length < 240) {
    fail(`Sample text is too short to exercise reader layout: ${sample.id}`);
  }
}
if (missing.length) {
  fail(`Sample articles must have complete string fields:\n${missing.join("\n")}`);
}

const requiredCategories = ["literary", "technology", "research"];
const missingCategories = requiredCategories.filter((category) => !categories.has(category));
if (missingCategories.length) {
  fail(`Sample articles must cover literary, technology, and academic/research types:\n${missingCategories.join("\n")}`);
}

const api = read("backend/app/api/samples.py");
for (const snippet of ['"excerpt": item["text"][:180]', '@router.get("")', '@router.get("/{sample_id}")']) {
  if (!api.includes(snippet)) {
    fail(`Samples API is missing expected behavior: ${snippet}`);
  }
}

const frontend = read("frontend/src/components/content/SampleLoader.tsx");
for (const snippet of ["listSamples()", "getSample(id)", 'source: sample.category', '"sample"']) {
  if (!frontend.includes(snippet)) {
    fail(`SampleLoader is missing expected sample loading behavior: ${snippet}`);
  }
}

const docs = read("DEVELOPMENT_DOC.md");
for (const snippet of ["内置 3-5 篇", "文学", "科技", "学术"]) {
  if (!docs.includes(snippet)) {
    fail(`Development doc sample requirement is missing expected wording: ${snippet}`);
  }
}

console.log("Sample article contract checks passed.");
