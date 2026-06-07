export interface LayoutInput {
  text: string;
  columnCount: number;
  fontSize: number;
  lineHeight: number;
}

export interface LayoutResult {
  text: string;
  columnCount: number;
}

export async function layoutText(input: LayoutInput): Promise<LayoutResult> {
  try {
    await import("@chenglou/pretext");
  } catch {
    // CSS columns remain the stable Phase 1 renderer when Pretext internals are unavailable.
  }

  return {
    text: input.text,
    columnCount: input.columnCount,
  };
}
