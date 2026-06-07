export type ContentSource = "arxiv" | "url" | "sample" | "file" | "text";

export type ThemeName = "dark" | "light" | "sepia" | "forest" | "ocean" | "sunset";

export type Language = "en" | "zh";

export interface ArticleMetadata {
  title?: string;
  author?: string | string[];
  source?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  preview?: string;
  cachedUntil?: string;
  fullTextSource?: "abstract" | "pdf";
  pdfUrl?: string | null;
  url?: string;
  siteName?: string;
  charCount?: number;
  excerpt?: string;
  published?: string;
  categories?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  warnings?: string[];
}

export interface UploadResult {
  file_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  detected_encoding: string;
  text: string;
  char_count: number;
  metadata: Record<string, unknown>;
  preview: string;
  cached_until: string;
}

export interface TextExtractResult {
  text: string;
  char_count: number;
  preview: string;
  truncated: boolean;
  metadata: {
    source?: string;
  };
}

export interface SampleSummary {
  id: string;
  title: string;
  author: string;
  category: string;
  excerpt: string;
}

export interface SampleArticle extends SampleSummary {
  text: string;
}

export interface ArxivArticle {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  full_text: string;
  full_text_source: "abstract" | "pdf";
  pdf_url: string | null;
  published: string;
  categories: string[];
}

export interface UrlArticle {
  url: string;
  title: string;
  author: string;
  site_name: string;
  text: string;
  char_count: number;
  excerpt: string;
}
