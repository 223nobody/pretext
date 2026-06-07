import type { ReaderPayload, ZoteroItemLike } from "./types";

declare const Zotero: any;

export async function getSelectedReaderPayload(): Promise<ReaderPayload | null> {
  const pane = Zotero.getActiveZoteroPane?.();
  const items: ZoteroItemLike[] = pane?.getSelectedItems?.() ?? [];
  const item = items[0];

  if (!item) {
    return null;
  }

  const title = item.getField("title") || "Untitled item";
  const abstract = item.getField("abstractNote") || "";
  const notesText = await readNotes(item);
  const attachmentText = await readAttachmentText(item);
  const parts = [
    { label: "Abstract", text: abstract },
    { label: "Notes", text: notesText },
    { label: "Attachments", text: attachmentText },
  ].filter((part) => part.text);

  return {
    title,
    authors: readAuthors(item),
    text: parts.map((part) => part.text).join("\n\n") || title,
    sources: parts.map((part) => part.label),
  };
}

function readAuthors(item: ZoteroItemLike): string[] {
  return (
    item.getCreators?.().map((creator) => {
      if (creator.name) {
        return creator.name;
      }
      return [creator.firstName, creator.lastName].filter(Boolean).join(" ");
    }) ?? []
  ).filter(Boolean);
}

async function readNotes(item: ZoteroItemLike): Promise<string> {
  const noteIds = (await item.getNotes?.()) ?? [];
  const notes: string[] = [];
  for (const noteId of noteIds) {
    const note = await Zotero.Items.getAsync(noteId);
    const noteText = note?.getNote?.() ?? "";
    if (noteText) {
      notes.push(stripHtml(noteText));
    }
  }
  return notes.join("\n\n");
}

async function readAttachmentText(item: ZoteroItemLike): Promise<string> {
  const attachmentIds = (await item.getAttachments?.()) ?? [];
  const texts: string[] = [];

  for (const attachmentId of attachmentIds) {
    const attachment = (await Zotero.Items.getAsync(attachmentId)) as ZoteroItemLike | null;
    if (!attachment || !isPdfAttachment(attachment)) {
      continue;
    }

    const indexed = await readIndexedAttachmentText(attachment);
    if (indexed) {
      texts.push(indexed);
      continue;
    }

    const fileText = await readAttachmentFileText(attachment);
    if (fileText) {
      texts.push(fileText);
    }
  }

  return texts.join("\n\n");
}

function isPdfAttachment(attachment: ZoteroItemLike): boolean {
  return Boolean(
    attachment.isPDFAttachment?.() ||
      attachment.attachmentContentType === "application/pdf" ||
      attachment.getField?.("contentType") === "application/pdf",
  );
}

async function readIndexedAttachmentText(attachment: ZoteroItemLike): Promise<string> {
  try {
    const fulltext = Zotero.Fulltext;
    const itemId = attachment.id;
    if (!fulltext || !itemId) {
      return "";
    }

    const text =
      (await fulltext.getItemText?.(itemId)) ??
      (await fulltext.getItemCacheFileContents?.(itemId)) ??
      "";
    return typeof text === "string" ? text.trim() : "";
  } catch {
    return "";
  }
}

async function readAttachmentFileText(attachment: ZoteroItemLike): Promise<string> {
  try {
    const path = await attachment.getFilePathAsync?.();
    if (!path) {
      return "";
    }

    const file = Zotero.File?.pathToFile?.(path);
    const text = await Zotero.File?.getContentsAsync?.(file);
    return typeof text === "string" ? text.trim() : "";
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
