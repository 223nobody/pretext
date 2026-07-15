export type ContentSource = "arxiv" | "url" | "file" | "text";

export interface ArticleMetadata {
  title?: string;
  author?: string | string[];
  source?: string;
  fileName?: string;
  mimeType?: string;
  published?: string;
}
