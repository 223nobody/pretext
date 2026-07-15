import { create } from "zustand";

import { defaultEngineMode } from "../lib/canvasSupport";
import { addToHistory, saveLastPosition, type LastPosition } from "../lib/history";
import type { VideoMaskResult } from "../lib/videoMaskAnalysis";
import type { ArticleMetadata, ContentSource, Language, ThemeName } from "../types";

export const MAX_READER_COLUMNS = 2;
export const READER_SERIF_FONT = "'Noto Serif SC', 'Noto Serif', Georgia, 'Times New Roman', serif";

function clampColumnCount(columnCount: number): number {
  return Math.min(MAX_READER_COLUMNS, Math.max(1, Math.round(columnCount)));
}

interface ReaderState {
  contentSource: ContentSource | null;
  text: string;
  metadata: ArticleMetadata | null;
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
  columnCount: number;
  columnGap: number;
  fontSize: number;
  lineHeight: number;
  currentPage: number;
  pageCount: number;
  bubbleRadius: number;
  customCursor: string | null;
  backgroundVideo: {
    url: string | null;
    fileName: string | null;
    sensitivity: number;
    edgePrecision: number;
    outlineWidth: number;
    inverted: boolean;
    maskX: number;
    maskY: number;
    maskSize: number;
    autoMask: boolean;
    contour: VideoMaskResult["contour"] | null;
  };
  /**
   * Incremented to force a background re-sample / re-layout (see
   * NEXT_DEVELOPMENT_PLAN §5.3.1). Consumers watch this token.
   */
  resampleToken: number;
  theme: ThemeName;
  language: Language;
  isHelpOpen: boolean;
  isSidebarOpen: boolean;
  isFullscreen: boolean;
  engineMode: "canvas" | "css";
  fontFamily: string;
  setLoading: (isLoading: boolean, progress?: number) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setContent: (text: string, metadata: ArticleMetadata, source: ContentSource) => void;
  setColumnCount: (columnCount: number) => void;
  setColumnGap: (columnGap: number) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setCurrentPage: (currentPage: number) => void;
  setPageCount: (pageCount: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setBubbleRadius: (bubbleRadius: number) => void;
  setCustomCursorFile: (file: File | null) => void;
  setBackgroundVideoFile: (file: File | null) => void;
  setBackgroundSensitivity: (sensitivity: number) => void;
  setBackgroundEdgePrecision: (edgePrecision: number) => void;
  setBackgroundOutlineWidth: (outlineWidth: number) => void;
  setBackgroundMask: (mask: { x?: number; y?: number; size?: number; contour?: VideoMaskResult["contour"] | null }) => void;
  toggleBackgroundAutoMask: () => void;
  toggleBackgroundInverted: () => void;
  resampleBackground: () => void;
  setTheme: (theme: ThemeName) => void;
  setLanguage: (language: Language) => void;
  toggleHelp: () => void;
  closeHelp: () => void;
  toggleSidebar: () => void;
  setFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => void;
  setEngineMode: (engineMode: "canvas" | "css") => void;
  setFontFamily: (fontFamily: string) => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  contentSource: null,
  text: "",
  metadata: null,
  isLoading: false,
  loadingProgress: 0,
  error: null,
  columnCount: 2,
  columnGap: 40,
  fontSize: 15,
  lineHeight: 1.7,
  currentPage: 0,
  pageCount: 1,
  bubbleRadius: 40,
  customCursor: null,
  backgroundVideo: {
    url: null,
    fileName: null,
    sensitivity: 38,
    edgePrecision: 3,
    outlineWidth: 0,
    inverted: false,
    maskX: 62,
    maskY: 36,
    maskSize: 220,
    autoMask: true,
    contour: null,
  },
  resampleToken: 0,
  theme: (import.meta.env.VITE_DEFAULT_THEME as ThemeName) || "light",
  language: "en",
  isHelpOpen: false,
  isSidebarOpen: true,
  isFullscreen: false,
  engineMode: defaultEngineMode(),
  fontFamily: READER_SERIF_FONT,
  setLoading: (isLoading, loadingProgress = isLoading ? 35 : 0) =>
    set((state) => ({
      isLoading,
      loadingProgress,
      error: isLoading ? null : state.error,
    })),
  setError: (error) => set({ error, isLoading: false, loadingProgress: 0 }),
  clearError: () => set({ error: null }),
  setContent: (text, metadata, contentSource) => {
    // Track reading history
    const id = metadata.title ?? `untitled-${Date.now()}`;
    addToHistory(id, metadata, contentSource);
    set({ text, metadata, contentSource, isLoading: false, loadingProgress: 100, error: null });
  },
  setColumnCount: (columnCount) => set({ columnCount: clampColumnCount(columnCount) }),
  setColumnGap: (columnGap) => set({ columnGap }),
  setFontSize: (fontSize) => set({ fontSize }),
  setLineHeight: (lineHeight) => set({ lineHeight }),
  setCurrentPage: (currentPage) => {
    set((state) => {
      const id = state.metadata?.title ?? "untitled";
      const pageCount = state.pageCount || 1;
      const scrollPercent = pageCount <= 1 ? 0 : (currentPage / (pageCount - 1)) * 100;
      saveLastPosition({ id, pageIndex: currentPage, scrollPercent });
      return { currentPage: Math.max(0, currentPage) };
    });
  },
  setPageCount: (pageCount) =>
    set((state) => ({
      pageCount: Math.max(1, pageCount),
      currentPage: Math.min(state.currentPage, Math.max(0, pageCount - 1)),
    })),
  nextPage: () =>
    set((state) => ({
      currentPage: Math.min(Math.max(0, state.pageCount - 1), state.currentPage + 1),
    })),
  previousPage: () => set((state) => ({ currentPage: Math.max(0, state.currentPage - 1) })),
  setBubbleRadius: (bubbleRadius) => set({ bubbleRadius }),
  setCustomCursorFile: (file) =>
    set((state) => {
      if (state.customCursor?.startsWith("blob:")) {
        URL.revokeObjectURL(state.customCursor);
      }
      return { customCursor: file ? URL.createObjectURL(file) : null };
    }),
  setBackgroundVideoFile: (file) =>
    set((state) => {
      if (state.backgroundVideo.url?.startsWith("blob:")) {
        URL.revokeObjectURL(state.backgroundVideo.url);
      }
      return {
        backgroundVideo: {
          ...state.backgroundVideo,
          url: file ? URL.createObjectURL(file) : null,
          fileName: file?.name ?? null,
          contour: null,
        },
      };
    }),
  setBackgroundSensitivity: (sensitivity) =>
    set((state) => ({
      backgroundVideo: { ...state.backgroundVideo, sensitivity },
    })),
  setBackgroundEdgePrecision: (edgePrecision) =>
    set((state) => ({
      backgroundVideo: { ...state.backgroundVideo, edgePrecision },
    })),
  setBackgroundOutlineWidth: (outlineWidth) =>
    set((state) => ({
      backgroundVideo: { ...state.backgroundVideo, outlineWidth },
    })),
  setBackgroundMask: (mask) =>
    set((state) => ({
      backgroundVideo: {
        ...state.backgroundVideo,
        maskX: mask.x ?? state.backgroundVideo.maskX,
        maskY: mask.y ?? state.backgroundVideo.maskY,
        maskSize: mask.size ?? state.backgroundVideo.maskSize,
        contour: mask.contour === undefined ? state.backgroundVideo.contour : mask.contour,
      },
    })),
  toggleBackgroundAutoMask: () =>
    set((state) => ({
      backgroundVideo: {
        ...state.backgroundVideo,
        autoMask: !state.backgroundVideo.autoMask,
      },
    })),
  toggleBackgroundInverted: () =>
    set((state) => ({
      backgroundVideo: {
        ...state.backgroundVideo,
        inverted: !state.backgroundVideo.inverted,
      },
    })),
  resampleBackground: () => set((state) => ({ resampleToken: state.resampleToken + 1 })),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen })),
  closeHelp: () => set({ isHelpOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  toggleFullscreen: () =>
    set((state) => {
      const next = !state.isFullscreen;
      if (typeof document !== "undefined") {
        if (next && !document.fullscreenElement) {
          void document.documentElement.requestFullscreen?.();
        }
        if (!next && document.fullscreenElement) {
          void document.exitFullscreen?.();
        }
      }
      return { isFullscreen: next };
    }),
  setEngineMode: (engineMode) => set({ engineMode }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
}));
