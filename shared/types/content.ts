export type ContentSource = "arxiv" | "url" | "sample" | "file";

export interface ArticleMetadata {
  title?: string;
  author?: string | string[];
  source?: string;
  fileName?: string;
  mimeType?: string;
  published?: string;
}
