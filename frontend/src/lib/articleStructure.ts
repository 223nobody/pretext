export type ArticleLineRole =
  | "title"
  | "author"
  | "abstract-heading"
  | "abstract-body"
  | "section-heading"
  | "metadata"
  | "body";

export interface ArticleBlock {
  role: ArticleLineRole;
  text: string;
  /** UTF-16 start offset in the normalized display text. */
  start: number;
  /** UTF-16 exclusive end offset in the normalized display text. */
  end: number;
}

export interface StructuredArticleText {
  text: string;
  blocks: ArticleBlock[];
}

interface TextLine {
  text: string;
}

const SECTION_NUMBER_RE = /^\d+(?:\.\d+)*$/;
const NUMBERED_HEADING_RE = /^\d+(?:\.\d+)*\s+\S+/;
const INLINE_SECTION_HEADING_RE = /\b\d+(?:\.\d+)*\s+(?:Introduction|Background|Method|Methods|Approach|Experiments?|Results?|Discussion|Conclusion|Conclusions|References|Acknowledg(?:e)?ments?|Appendix)\b/i;
const KNOWN_HEADING_RE = /^(abstract|introduction|background|method|methods|approach|experiments?|results?|discussion|conclusion|conclusions|references|acknowledg(?:e)?ments?|appendix)\b/i;
const EMAIL_RE = /@/;
const AFFILIATION_RE = /\b(university|laboratory|institute|division|department|berkeley|usa|school|college|lab)\b/i;
const METADATA_RE = /^(arXiv:|Originally presented|Preprint|Submitted|Accepted|\[[\d,\s-]+\]|[*∗†‡]|\d+(?:st|nd|rd|th)\s+Conference|Conference|Proceedings|NeurIPS|NIPS)\b/i;
const LEADING_NOTICE_RE = /\b(Provided proper attribution|grants permission|reproduce the tables|journalistic or scholarly works|scholarly works|copyright|all rights reserved)\b/i;
const AUTHOR_MARK_RE = /[*∗†‡]|\d$/;

function cleanTextLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function addBlock(
  parts: string[],
  blocks: ArticleBlock[],
  role: ArticleLineRole,
  text: string,
  separator = "\n",
) {
  const clean = cleanTextLine(text);
  if (!clean) return;

  if (parts.length > 0) {
    parts.push(separator);
  }

  const start = parts.join("").length;
  parts.push(clean);
  const end = start + clean.length;
  blocks.push({ role, text: clean, start, end });
}

function looksLikeHeading(line: string): boolean {
  const text = cleanTextLine(line);
  if (!text) return false;
  if (SECTION_NUMBER_RE.test(text)) return true;
  if (NUMBERED_HEADING_RE.test(text)) return true;
  if (INLINE_SECTION_HEADING_RE.test(text)) return true;
  if (KNOWN_HEADING_RE.test(text)) return true;
  return false;
}

function looksLikeFrontMatter(line: string): boolean {
  return EMAIL_RE.test(line) || AFFILIATION_RE.test(line);
}

function looksLikeAuthorLine(line: string, nextLine?: string): boolean {
  const text = cleanTextLine(line);
  if (!text) return false;
  if (looksLikeFrontMatter(text)) return true;
  if (AUTHOR_MARK_RE.test(text)) return true;

  const words = text.split(/\s+/);
  const personLike =
    words.length >= 2 &&
    words.length <= 5 &&
    words.every((word) => /^[A-ZÀ-ÖØ-ÞŁ][A-Za-zÀ-ÖØ-öø-ÿŁł.'-]*[*∗†‡]?$/.test(word));

  return Boolean(personLike && nextLine && looksLikeFrontMatter(nextLine));
}

function dropLeadingNotices(lines: string[]): string[] {
  let firstArticleLine = 0;

  while (
    firstArticleLine < lines.length &&
    (LEADING_NOTICE_RE.test(lines[firstArticleLine]) || METADATA_RE.test(lines[firstArticleLine]))
  ) {
    firstArticleLine++;
  }

  return lines.slice(firstArticleLine);
}

function inferTitleLineCount(preAbstractLines: string[]): number {
  if (preAbstractLines.length <= 1) return preAbstractLines.length;

  for (let i = 1; i < preAbstractLines.length; i++) {
    if (looksLikeAuthorLine(preAbstractLines[i], preAbstractLines[i + 1])) {
      return Math.max(1, i);
    }
  }

  return Math.min(2, preAbstractLines.length);
}

function structurePlainText(text: string): StructuredArticleText {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(cleanTextLine)
    .filter(Boolean);
  const parts: string[] = [];
  const blocks: ArticleBlock[] = [];

  for (const paragraph of paragraphs) {
    addBlock(parts, blocks, looksLikeHeading(paragraph) ? "section-heading" : "body", paragraph, "\n\n");
  }

  return { text: parts.join(""), blocks };
}

/**
 * PDF extraction often returns physical line breaks. This pass turns those
 * fragments into semantic article blocks before Pretext performs visual line
 * wrapping. The block ranges are later mapped back to Pretext lines, so visual
 * wrapping cannot erase title / abstract / section identity.
 */
export function structureArticleText(text: string): StructuredArticleText {
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map(cleanTextLine);
  const nonEmpty = dropLeadingNotices(lines.filter(Boolean));

  if (nonEmpty.length < 8 || !nonEmpty.some((line) => /^abstract$/i.test(line))) {
    return structurePlainText(text);
  }

  const abstractIndex = nonEmpty.findIndex((line) => /^abstract$/i.test(line));
  const parts: string[] = [];
  const blocks: ArticleBlock[] = [];

  if (abstractIndex > 0) {
    const preAbstractLines = nonEmpty.slice(0, abstractIndex);
    const titleLineCount = inferTitleLineCount(preAbstractLines);
    addBlock(parts, blocks, "title", preAbstractLines.slice(0, titleLineCount).join(" "), "\n");

    const byline = preAbstractLines.slice(titleLineCount).join(" · ");
    if (byline) {
      addBlock(parts, blocks, "author", byline, "\n");
    }
  }

  addBlock(parts, blocks, "abstract-heading", "Abstract", "\n\n");

  let i = abstractIndex + 1;
  let paragraph: string[] = [];
  let paragraphRole: ArticleLineRole = "abstract-body";
  let inPostAbstractMetadata = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    addBlock(parts, blocks, paragraphRole, paragraph.join(" "), "\n");
    paragraph = [];
  };

  while (i < nonEmpty.length) {
    const line = nonEmpty[i];
    const next = nonEmpty[i + 1];

    if (SECTION_NUMBER_RE.test(line) && next && next.length <= 110) {
      flushParagraph();
      addBlock(parts, blocks, "section-heading", `${line} ${next}`, "\n\n");
      paragraphRole = "body";
      inPostAbstractMetadata = false;
      i += 2;
      continue;
    }

    if (KNOWN_HEADING_RE.test(line) && line.length <= 110) {
      flushParagraph();
      addBlock(parts, blocks, "section-heading", line, "\n\n");
      paragraphRole = "body";
      inPostAbstractMetadata = false;
      i++;
      continue;
    }

    if (METADATA_RE.test(line) || (inPostAbstractMetadata && paragraphRole === "abstract-body")) {
      flushParagraph();
      addBlock(parts, blocks, "metadata", line, "\n");
      inPostAbstractMetadata = true;
      i++;
      continue;
    }

    paragraph.push(line);
    i++;
  }
  flushParagraph();

  return { text: parts.join("").replace(/\n{4,}/g, "\n\n\n").trim(), blocks };
}

export function normalizeArticleText(text: string): string {
  return structureArticleText(text).text;
}

export function roleForTextOffset(blocks: ArticleBlock[], offset: number): ArticleLineRole {
  if (blocks.length === 0) return "body";
  const direct = blocks.find((block) => offset >= block.start && offset < block.end);
  if (direct) return direct.role;

  const previous = [...blocks].reverse().find((block) => offset >= block.end);
  return previous?.role ?? blocks[0]?.role ?? "body";
}

export function assignArticleLineRoles(lines: TextLine[]): ArticleLineRole[] {
  const roles: ArticleLineRole[] = [];
  let state: "front" | "abstract" | "body" = "front";
  let titleLines = 0;

  for (const line of lines) {
    const text = cleanTextLine(line.text ?? "");

    if (!text) {
      roles.push("body");
      continue;
    }

    if (METADATA_RE.test(text)) {
      roles.push("metadata");
      continue;
    }

    if (/^abstract\b/i.test(text)) {
      roles.push("abstract-heading");
      state = "abstract";
      continue;
    }

    if (state === "front") {
      if (titleLines < 3 && !looksLikeFrontMatter(text)) {
        roles.push("title");
        titleLines++;
      } else {
        roles.push("author");
      }
      continue;
    }

    if (looksLikeHeading(text)) {
      roles.push("section-heading");
      state = "body";
      continue;
    }

    if (state === "abstract") {
      roles.push("abstract-body");
      continue;
    }

    roles.push("body");
  }

  return roles;
}
