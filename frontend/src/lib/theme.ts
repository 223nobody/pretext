import type { ThemeName } from "../types";

export const THEMES: Array<{ name: ThemeName; label: string; swatch: string }> = [
  { name: "light", label: "Light", swatch: "#f7f8fb" },
  { name: "dark", label: "Dark", swatch: "#171a21" },
  { name: "sepia", label: "Paper", swatch: "#efe4cf" },
  { name: "forest", label: "Forest", swatch: "#1f3a35" },
  { name: "ocean", label: "Ocean", swatch: "#12384a" },
  { name: "sunset", label: "Sunset", swatch: "#5c3345" },
];
