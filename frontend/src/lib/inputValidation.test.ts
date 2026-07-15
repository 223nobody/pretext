import { describe, expect, it } from "vitest";

import { classifyInput, normalizeArxivId } from "./inputValidation";

describe("classifyInput", () => {
  it("recognises ArXiv IDs with optional arxiv: prefix", () => {
    expect(classifyInput("2301.12345")).toBe("arxiv");
    expect(classifyInput("2606.07436")).toBe("arxiv");
    expect(classifyInput("2301.12345v2")).toBe("arxiv");
    expect(classifyInput("arxiv:2301.12345")).toBe("arxiv");
    expect(classifyInput("ARXIV:2301.12345")).toBe("arxiv");
    expect(classifyInput("physics/0706123v3")).toBe("arxiv");
  });

  it("recognises arxiv.org/abs URLs as ArXiv (not generic URL)", () => {
    expect(classifyInput("https://arxiv.org/abs/2606.07436")).toBe("arxiv");
    expect(classifyInput("http://arxiv.org/abs/2301.12345v2")).toBe("arxiv");
  });

  it("recognises other URLs", () => {
    expect(classifyInput("https://example.com/article")).toBe("url");
    expect(classifyInput("http://example.com")).toBe("url");
  });

  it("classifies everything else as text", () => {
    expect(classifyInput("Hello world")).toBe("text");
    expect(classifyInput("A multi word sentence.")).toBe("text");
    expect(classifyInput("arxiv.org/abs/2301.12345")).toBe("text"); // not a URL (no scheme)
  });

  it("returns empty for whitespace-only input", () => {
    expect(classifyInput("")).toBe("empty");
    expect(classifyInput("   ")).toBe("empty");
  });
});

describe("normalizeArxivId", () => {
  it("strips arxiv: prefix and extracts from arxiv.org/abs URLs", () => {
    expect(normalizeArxivId("arxiv:2301.12345")).toBe("2301.12345");
    expect(normalizeArxivId("https://arxiv.org/abs/2606.07436")).toBe("2606.07436");
    expect(normalizeArxivId("http://arxiv.org/abs/2301.12345v2")).toBe("2301.12345v2");
    expect(normalizeArxivId("  2301.12345  ")).toBe("2301.12345");
  });
});
