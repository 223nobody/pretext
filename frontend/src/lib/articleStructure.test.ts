import { describe, expect, it } from "vitest";

import {
  assignArticleLineRoles,
  normalizeArticleText,
  roleForTextOffset,
  structureArticleText,
} from "./articleStructure";

describe("article structure helpers", () => {
  it("normalizes PDF physical lines into article sections", () => {
    const normalized = normalizeArticleText([
      "Graph Structure from Point Clouds: Geometric",
      "Attention is All You Need",
      "Daniel Murnane",
      "Scientific Data Division",
      "Abstract",
      "The use of graph neural networks has produced significant advances",
      "in point cloud problems.",
      "1",
      "Introduction",
      "Relational neural networks such as transformers",
      "have pushed the limits of ML performance.",
    ].join("\n"));

    expect(normalized).toContain("Graph Structure from Point Clouds: Geometric Attention is All You Need");
    expect(normalized).toContain("Daniel Murnane · Scientific Data Division");
    expect(normalized).toContain("Abstract\n");
    expect(normalized).toContain("1 Introduction");
  });

  it("returns stable block ranges for semantic article rendering", () => {
    const structured = structureArticleText([
      "Graph Structure from Point Clouds: Geometric",
      "Attention is All You Need",
      "Daniel Murnane",
      "Scientific Data Division",
      "Abstract",
      "The use of graph neural networks has produced significant advances",
      "in point cloud problems.",
      "1",
      "Introduction",
      "Relational neural networks such as transformers",
      "have pushed the limits of ML performance.",
    ].join("\n"));

    const abstractBlock = structured.blocks.find((block) => block.role === "abstract-body");
    const introBlock = structured.blocks.find((block) => block.role === "section-heading");

    expect(abstractBlock?.text).toContain("graph neural networks");
    expect(introBlock?.text).toBe("1 Introduction");
    expect(roleForTextOffset(structured.blocks, abstractBlock!.start)).toBe("abstract-body");
    expect(roleForTextOffset(structured.blocks, introBlock!.start)).toBe("section-heading");
  });

  it("skips publisher notices and footnotes before rendering paper sections", () => {
    const structured = structureArticleText([
      "Provided proper attribution is provided, Google hereby grants permission to",
      "reproduce the tables and figures in this paper solely for use in journalistic or",
      "scholarly works.",
      "Attention Is All You Need",
      "Ashish Vaswani∗",
      "Google Brain",
      "avaswani@google.com",
      "Noam Shazeer∗",
      "Google Brain",
      "noam@google.com",
      "Abstract",
      "The dominant sequence transduction models are based on complex recurrent or",
      "convolutional neural networks.",
      "∗Equal contribution. Listing order is random.",
      "Jakob proposed replacing RNNs with self-attention and started the effort.",
      "31st Conference on Neural Information Processing Systems (NIPS 2017), Long Beach, CA, USA.",
      "arXiv:1706.03762v7  [cs.CL]  2 Aug 2023",
      "1",
      "Introduction",
      "Recurrent neural networks have been firmly established.",
    ].join("\n"));

    expect(structured.blocks[0]).toMatchObject({
      role: "title",
      text: "Attention Is All You Need",
    });
    expect(structured.text).not.toContain("Provided proper attribution");
    expect(structured.blocks.filter((block) => block.role === "metadata").map((block) => block.text)).toEqual([
      "∗Equal contribution. Listing order is random.",
      "Jakob proposed replacing RNNs with self-attention and started the effort.",
      "31st Conference on Neural Information Processing Systems (NIPS 2017), Long Beach, CA, USA.",
      "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023",
    ]);
    expect(structured.blocks.find((block) => block.role === "section-heading")?.text).toBe("1 Introduction");
  });

  it("assigns visual roles to title, abstract, and section lines", () => {
    const roles = assignArticleLineRoles([
      { text: "Graph Structure from Point Clouds: Geometric Attention is All You Need" },
      { text: "Daniel Murnane · Scientific Data Division" },
      { text: "Abstract" },
      { text: "The use of graph neural networks has produced significant advances" },
      { text: "1 Introduction" },
      { text: "Relational neural networks such as transformers" },
    ]);

    expect(roles).toEqual([
      "title",
      "author",
      "abstract-heading",
      "abstract-body",
      "section-heading",
      "body",
    ]);
  });

  it("switches out of abstract state when a numbered heading is folded into a line", () => {
    const roles = assignArticleLineRoles([
      { text: "Paper Title" },
      { text: "Author Laboratory" },
      { text: "Abstract The summary starts here" },
      { text: "and continues until the folded marker. 1 Introduction Relational models" },
      { text: "This should now be normal body text." },
    ]);

    expect(roles).toEqual([
      "title",
      "author",
      "abstract-heading",
      "section-heading",
      "body",
    ]);
  });
});
