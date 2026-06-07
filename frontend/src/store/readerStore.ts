import { create } from "zustand";

import type { ArticleMetadata, ContentSource, Language, ThemeName } from "../types";

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
  paragraphsPerPage: number;
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
  };
  theme: ThemeName;
  language: Language;
  isHelpOpen: boolean;
  isSidebarOpen: boolean;
  isFullscreen: boolean;
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
  setBackgroundMask: (mask: { x?: number; y?: number; size?: number }) => void;
  toggleBackgroundAutoMask: () => void;
  toggleBackgroundInverted: () => void;
  setTheme: (theme: ThemeName) => void;
  setLanguage: (language: Language) => void;
  toggleHelp: () => void;
  closeHelp: () => void;
  toggleSidebar: () => void;
  setFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => void;
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
  fontSize: 18,
  lineHeight: 1.65,
  currentPage: 0,
  pageCount: 1,
  paragraphsPerPage: 18,
  bubbleRadius: 80,
  customCursor: null,
  backgroundVideo: {
    url: null,
    fileName: null,
    sensitivity: 40,
    edgePrecision: 5,
    outlineWidth: 6,
    inverted: false,
    maskX: 62,
    maskY: 36,
    maskSize: 220,
    autoMask: true,
  },
  theme: (import.meta.env.VITE_DEFAULT_THEME as ThemeName) || "dark",
  language: "en",
  isHelpOpen: false,
  isSidebarOpen: true,
  isFullscreen: false,
  setLoading: (isLoading, loadingProgress = isLoading ? 35 : 0) =>
    set((state) => ({
      isLoading,
      loadingProgress,
      error: isLoading ? null : state.error,
    })),
  setError: (error) => set({ error, isLoading: false, loadingProgress: 0 }),
  clearError: () => set({ error: null }),
  setContent: (text, metadata, contentSource) =>
    set({ text, metadata, contentSource, isLoading: false, loadingProgress: 100, error: null }),
  setColumnCount: (columnCount) => set({ columnCount }),
  setColumnGap: (columnGap) => set({ columnGap }),
  setFontSize: (fontSize) => set({ fontSize }),
  setLineHeight: (lineHeight) => set({ lineHeight }),
  setCurrentPage: (currentPage) => set({ currentPage: Math.max(0, currentPage) }),
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
}));
