/**
 * Article text search (NEXT_DEVELOPMENT_PLAN §7.3.3).
 *
 * Finds keyword positions in a Pretext-laid-out text so the reader can
 * highlight matches and jump between them.
 */
export interface SearchMatch {
  /** Zero-based page index (from the PageLayoutResult). */
  pageIndex: number;
  /** The matched substring text. */
  text: string;
  /** Character offset within the page's flattened text. */
  start: number;
  /** Character offset within the page's flattened text. */
  end: number;
}

interface FlattenedPage {
  pageIndex: number;
  text: string;
  /** Maps a character offset in the flattened text to a column/line pair. */
  positions: { columnIndex: number; lineIndex: number }[];
}

/**
 * Flattens each page's column/lines into a contiguous string while tracking
 * the column/line provenance of every character — used for accurate highlight
 * positioning.
 */
interface FlatPageInput {
  columns: { columnIndex: number; lines: { text: string }[] }[];
}

function flattenPages(pages: FlatPageInput[]): FlattenedPage[] {
  return pages.map((page, pageIndex) => {
    const chunks: string[] = [];
    const positions: FlattenedPage["positions"] = [];
    for (const column of page.columns) {
      for (let li = 0; li < column.lines.length; li++) {
        const lineText = column.lines[li].text;
        for (let ci = 0; ci < lineText.length; ci++) {
          positions.push({ columnIndex: column.columnIndex, lineIndex: li });
        }
        chunks.push(lineText);
      }
    }
    return { pageIndex, text: chunks.join(""), positions };
  });
}

/**
 * Searches all pages of a Pretext layout for `query` (case-insensitive
 * substring), returning one match per occurrence.
 */
export function searchPages(
  pages: FlatPageInput[],
  query: string,
): SearchMatch[] {
  const lowerQuery = query.toLowerCase();
  if (!lowerQuery || pages.length === 0) return [];

  const flat = flattenPages(pages);
  const matches: SearchMatch[] = [];

  for (const page of flat) {
    const lowerText = page.text.toLowerCase();
    let searchFrom = 0;
    while (true) {
      const idx = lowerText.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;
      matches.push({
        pageIndex: page.pageIndex,
        text: page.text.slice(idx, idx + query.length),
        start: idx,
        end: idx + query.length,
      });
      searchFrom = idx + 1;
    }
  }

  return matches;
}

/**
 * Returns a navigation target — the next match after `currentPageIndex`, or
 * the first match if all current-page matches are behind the current one.
 * Wraps around to the beginning when at the end.
 */
export function nextMatch(
  matches: SearchMatch[],
  currentPageIndex: number,
): SearchMatch | null {
  if (!matches.length) return null;
  const after = matches.find((m) => m.pageIndex > currentPageIndex);
  return after ?? matches[0];
}
