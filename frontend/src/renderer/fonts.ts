export async function ensureFontsReady(): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
}

export function getFontFamily(): string {
  return (
    getComputedStyle(document.documentElement).fontFamily ||
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  );
}

export function buildCssFont(fontSize: number, fontFamily: string): string {
  return `${fontSize}px ${fontFamily}`;
}

export function readThemeColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}
