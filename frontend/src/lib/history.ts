/**
 * Reading history and bookmarks — persisted to localStorage.
 */

import type { ArticleMetadata } from "../types";

const HISTORY_KEY = "pretext:history";
const BOOKMARKS_KEY = "pretext:bookmarks";
const LAST_POSITION_KEY = "pretext:lastPosition";
const MAX_HISTORY = 50;

export interface HistoryEntry {
  id: string;
  title: string;
  source: string;
  fileName?: string;
  charCount?: number;
  openedAt: string; // ISO timestamp
}

export interface BookmarkEntry {
  id: string;
  title: string;
  source: string;
  pageIndex: number;
  scrollPercent: number;
  savedAt: string;
}

export interface LastPosition {
  id: string;
  pageIndex: number;
  scrollPercent: number;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addToHistory(
  id: string,
  metadata: ArticleMetadata,
  source: string,
): void {
  const history = getHistory();
  const entry: HistoryEntry = {
    id,
    title: metadata.title ?? id,
    source,
    fileName: metadata.fileName,
    charCount: metadata.charCount,
    openedAt: new Date().toISOString(),
  };

  // Remove existing entry with same id (avoid duplicates)
  const filtered = history.filter((e) => e.id !== id);

  // Add to front, cap at MAX_HISTORY
  filtered.unshift(entry);
  if (filtered.length > MAX_HISTORY) {
    filtered.length = MAX_HISTORY;
  }

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage full — clear old entries
    filtered.length = Math.min(filtered.length, 10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  }
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

export function getBookmarks(): BookmarkEntry[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BookmarkEntry[];
  } catch {
    return [];
  }
}

export function addBookmark(
  id: string,
  title: string,
  source: string,
  pageIndex: number,
  scrollPercent: number,
): void {
  const bookmarks = getBookmarks();
  const entry: BookmarkEntry = {
    id,
    title,
    source,
    pageIndex,
    scrollPercent,
    savedAt: new Date().toISOString(),
  };

  const filtered = bookmarks.filter((b) => b.id !== id);
  filtered.unshift(entry);

  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
  } catch {
    // Silently fail if localStorage is full
  }
}

export function removeBookmark(id: string): void {
  const bookmarks = getBookmarks().filter((b) => b.id !== id);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

export function isBookmarked(id: string): boolean {
  return getBookmarks().some((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// Last position (restore reading position on revisit)
// ---------------------------------------------------------------------------

export function saveLastPosition(position: LastPosition): void {
  try {
    localStorage.setItem(LAST_POSITION_KEY, JSON.stringify(position));
  } catch {
    // Silently fail
  }
}

export function getLastPosition(id: string): LastPosition | null {
  try {
    const raw = localStorage.getItem(LAST_POSITION_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw) as LastPosition;
    return pos.id === id ? pos : null;
  } catch {
    return null;
  }
}

export function clearLastPosition(): void {
  localStorage.removeItem(LAST_POSITION_KEY);
}
