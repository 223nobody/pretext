export interface ReaderPayload {
  title: string;
  authors: string[];
  text: string;
  sources: string[];
}

export interface ZoteroItemLike {
  id?: number;
  key?: string;
  getField(field: string): string;
  getCreators?(): Array<{ firstName?: string; lastName?: string; name?: string }>;
  getNotes?(): Promise<number[]>;
  getAttachments?(): Promise<number[]>;
  attachmentContentType?: string;
  isPDFAttachment?(): boolean;
  getFilePathAsync?(): Promise<string>;
}
