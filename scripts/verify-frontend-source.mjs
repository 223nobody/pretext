import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const frontendSrc = resolve(root, "frontend", "src");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, files);
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

function fail(message) {
  throw new Error(message);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractCssBlock(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] ?? "";
}

function extractCssVariables(block) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)]
      .map((match) => [match[1], match[2].toLowerCase()]),
  );
}

function extractDictionaryKeys(source, language) {
  const start = source.indexOf(`  ${language}: {`);
  if (start === -1) {
    fail(`Missing ${language} dictionary in frontend/src/lib/i18n.ts`);
  }
  const nextLanguage = language === "en" ? source.indexOf("\n  zh: {", start) : source.indexOf("\n  },\n}", start);
  const end = nextLanguage === -1 ? source.length : nextLanguage;
  const block = source.slice(start, end);
  return [...block.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1]);
}

function assertSameDictionaryKeys() {
  const source = read("frontend/src/lib/i18n.ts");
  const enKeys = extractDictionaryKeys(source, "en");
  const zhKeys = extractDictionaryKeys(source, "zh");
  const enSet = new Set(enKeys);
  const zhSet = new Set(zhKeys);
  const missingZh = enKeys.filter((key) => !zhSet.has(key));
  const missingEn = zhKeys.filter((key) => !enSet.has(key));
  if (missingZh.length || missingEn.length) {
    fail(
      [
        missingZh.length ? `Missing zh translations: ${missingZh.join(", ")}` : "",
        missingEn.length ? `Missing en translations: ${missingEn.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function assertPlaceholderInputsAreNamed() {
  const violations = [];
  for (const file of walkFiles(frontendSrc)) {
    const source = readFileSync(file, "utf8");
    const fieldTags = [
      ...(source.match(/<input\b[\s\S]*?\/>/g) ?? []),
      ...(source.match(/<textarea\b[\s\S]*?>/g) ?? []),
    ];
    for (const tag of fieldTags) {
      if (tag.includes("placeholder=") && !tag.includes("aria-label=") && !tag.includes("aria-labelledby=")) {
        violations.push(`${relative(root, file)}: ${tag.replace(/\s+/g, " ").trim()}`);
      }
    }
  }
  if (violations.length) {
    fail(`Inputs with placeholders must also have accessible names:\n${violations.join("\n")}`);
  }
}

function assertUploadProgressIsAccessible() {
  const component = read("frontend/src/components/upload/UploadProgress.tsx");
  const readerArea = read("frontend/src/components/layout/ReaderArea.tsx");
  if (!component.includes('role="progressbar"')) {
    fail("UploadProgress must expose role=\"progressbar\".");
  }
  if (!component.includes("aria-label={label}")) {
    fail("UploadProgress must expose its localized label through aria-label.");
  }
  if (!readerArea.includes('<UploadProgress value={loadingProgress} label={t(language, "uploadProgress")} />')) {
    fail("ReaderArea must pass the localized uploadProgress label to UploadProgress.");
  }
}

function assertReadingProgressIsAccessible() {
  const component = read("frontend/src/components/reader/ProgressBar.tsx");
  const pageCanvas = read("frontend/src/components/reader/PageCanvas.tsx");
  const requiredSnippets = [
    'role="progressbar"',
    "aria-label={label}",
    "aria-valuemin={0}",
    "aria-valuemax={100}",
    "aria-valuenow={safeValue}",
    "Math.min(100, Math.max(0, Math.round(value)))",
  ];
  const missing = requiredSnippets.filter((snippet) => !component.includes(snippet));
  if (missing.length) {
    fail(`Reading ProgressBar must expose accessible progress semantics:\n${missing.join("\n")}`);
  }
  if (!pageCanvas.includes('<ProgressBar value={hasText ? progress : 0} label={t(language, "readingProgress")} />')) {
    fail("PageCanvas must pass the localized readingProgress label to ProgressBar.");
  }
}

function assertUserErrorsAreLocalized() {
  const violations = [];
  for (const file of walkFiles(frontendSrc)) {
    const relativePath = relative(root, file);
    if (relativePath.endsWith(join("frontend", "src", "lib", "apiErrors.ts"))) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    if (source.includes("error.message")) {
      violations.push(relativePath);
    }
  }
  if (violations.length) {
    fail(`User-facing error paths should use localized messages instead of error.message:\n${violations.join("\n")}`);
  }
}

function assertContentInputsDisableWhileLoading() {
  const requiredSnippets = [
    {
      file: "frontend/src/components/content/TextInput.tsx",
      snippets: [
        "const isLoading = useReaderStore((state) => state.isLoading);",
        "if (isLoading) {",
        "disabled={isLoading}",
      ],
    },
    {
      file: "frontend/src/components/content/ArXivInput.tsx",
      snippets: [
        "const isLoading = useReaderStore((state) => state.isLoading);",
        "if (isLoading) {",
        "disabled={isLoading}",
      ],
    },
    {
      file: "frontend/src/components/content/UrlInput.tsx",
      snippets: [
        "const isLoading = useReaderStore((state) => state.isLoading);",
        "if (isLoading) {",
        "disabled={isLoading}",
      ],
    },
    {
      file: "frontend/src/components/content/SampleLoader.tsx",
      snippets: [
        "const isLoading = useReaderStore((state) => state.isLoading);",
        "if (isLoading) {",
        "disabled={isLoading}",
      ],
    },
    {
      file: "frontend/src/components/upload/FileUpload.tsx",
      snippets: [
        "const isLoading = useReaderStore((state) => state.isLoading);",
        "if (isLoading) {",
        "<UploadDropZone disabled={isLoading} onFileSelected={onFileSelected} />",
      ],
    },
    {
      file: "frontend/src/components/upload/UploadDropZone.tsx",
      snippets: [
        "disabled?: boolean;",
        "disabled={disabled}",
      ],
    },
  ];

  for (const requirement of requiredSnippets) {
    const source = read(requirement.file);
    const missing = requirement.snippets.filter((snippet) => !source.includes(snippet));
    if (missing.length) {
      fail(`${requirement.file} is missing loading-state duplicate-submit protection:\n${missing.join("\n")}`);
    }
  }
}

function assertReaderLayoutControlsMatchDevelopmentDoc() {
  const store = read("frontend/src/store/readerStore.ts");
  const sidebar = read("frontend/src/components/layout/Sidebar.tsx");
  const textLayer = read("frontend/src/components/reader/TextLayer.tsx");
  const columnSlider = read("frontend/src/components/controls/ColumnSlider.tsx");
  const fontSizeSlider = read("frontend/src/components/controls/FontSizeSlider.tsx");
  const keyboard = read("frontend/src/hooks/useKeyboard.ts");

  const requirements = [
    {
      name: "column count 1-2",
      source: store + columnSlider + keyboard,
      snippets: [
        "export const MAX_READER_COLUMNS = 2;",
        'min="1"',
        "max={MAX_READER_COLUMNS}",
        "setColumnCount(Number(event.target.value))",
        'event.key <= String(MAX_READER_COLUMNS)',
      ],
    },
    {
      name: "adjustable column gap",
      source: store + sidebar + textLayer,
      snippets: ["columnGap: number;", "setColumnGap", 'min="16"', 'max="80"', "columnGap,"],
    },
    {
      name: "font size 12-28px",
      source: fontSizeSlider,
      snippets: ['min="12"', 'max="28"', "setFontSize(Number(event.target.value))"],
    },
    {
      name: "line height 1.2-2.2",
      source: sidebar,
      snippets: ['min="1.2"', 'max="2.2"', "setLineHeight(Number(event.target.value))"],
    },
    {
      name: "bubble radius 0-150px",
      source: store + sidebar,
      snippets: ["bubbleRadius: number;", 'min="0"', 'max="150"', "setBubbleRadius(Number(event.target.value))"],
    },
  ];

  for (const requirement of requirements) {
    const missing = requirement.snippets.filter((snippet) => !requirement.source.includes(snippet));
    if (missing.length) {
      fail(`Reader layout control does not match development doc (${requirement.name}):\n${missing.join("\n")}`);
    }
  }
}

function assertKeyboardShortcutsIgnoreEditingTargets() {
  const keyboard = read("frontend/src/hooks/useKeyboard.ts");
  const requiredSnippets = [
    "function isEditingTarget(target: EventTarget | null): boolean",
    "target instanceof HTMLInputElement",
    "target instanceof HTMLTextAreaElement",
    "target instanceof HTMLSelectElement",
    "target.isContentEditable",
    "if (isEditingTarget(event.target))",
  ];
  const missing = requiredSnippets.filter((snippet) => !keyboard.includes(snippet));
  if (missing.length) {
    fail(`Keyboard shortcuts must not fire while editing text or form fields:\n${missing.join("\n")}`);
  }
}

function assertFullscreenControlIsLocalized() {
  const component = read("frontend/src/components/controls/FullscreenButton.tsx");
  const i18n = read("frontend/src/lib/i18n.ts");
  const requiredSnippets = [
    'exitFullscreen: "Exit full screen"',
    'exitFullscreen: "退出全屏"',
  ];
  const missing = requiredSnippets.filter((snippet) => !i18n.includes(snippet));
  if (missing.length) {
    fail(`Fullscreen control must have localized labels:\n${missing.join("\n")}`);
  }
  if (!component.includes('t(language, isFullscreen ? "exitFullscreen" : "fullscreen")')) {
    fail("FullscreenButton must use localized labels for enter and exit states.");
  }
  if (component.includes('"Exit full screen"') || component.includes('"Full screen"')) {
    fail("FullscreenButton must not hard-code English labels.");
  }
}

function assertFullscreenModeUsesBrowserApi() {
  const store = read("frontend/src/store/readerStore.ts");
  const app = read("frontend/src/App.tsx");
  const keyboard = read("frontend/src/hooks/useKeyboard.ts");
  const button = read("frontend/src/components/controls/FullscreenButton.tsx");

  const storeSnippets = [
    "setFullscreen: (isFullscreen: boolean) => void;",
    "setFullscreen: (isFullscreen) => set({ isFullscreen })",
    "document.documentElement.requestFullscreen?.()",
    "document.exitFullscreen?.()",
    "document.fullscreenElement",
  ];
  const missingStore = storeSnippets.filter((snippet) => !store.includes(snippet));
  if (missingStore.length) {
    fail(`Fullscreen store state must integrate with the browser Fullscreen API:\n${missingStore.join("\n")}`);
  }

  const appSnippets = [
    "const setFullscreen = useReaderStore((state) => state.setFullscreen);",
    'document.body.classList.toggle("fullscreen-reader", isFullscreen);',
    'document.addEventListener("fullscreenchange", onFullscreenChange);',
    'document.removeEventListener("fullscreenchange", onFullscreenChange);',
    "setFullscreen(Boolean(document.fullscreenElement));",
  ];
  const missingApp = appSnippets.filter((snippet) => !app.includes(snippet));
  if (missingApp.length) {
    fail(`App must synchronize fullscreen CSS state with browser fullscreen changes:\n${missingApp.join("\n")}`);
  }
  if (!keyboard.includes("toggleFullscreen();") || !button.includes("onClick={toggleFullscreen}")) {
    fail("Fullscreen mode must remain reachable from keyboard shortcut and the toolbar button.");
  }
}

function assertBackgroundControlsAreLocalizedAndNamed() {
  const component = read("frontend/src/components/controls/BackgroundControls.tsx");
  const i18n = read("frontend/src/lib/i18n.ts");
  const requiredI18n = [
    'sensitivity: "Sensitivity"',
    'outline: "Outline"',
    'sensitivity: "灵敏度"',
    'outline: "轮廓"',
  ];
  const missingI18n = requiredI18n.filter((snippet) => !i18n.includes(snippet));
  if (missingI18n.length) {
    fail(`Background controls must have localized labels:\n${missingI18n.join("\n")}`);
  }

  const requiredComponent = [
    '<span className="visually-hidden">{t(language, "sensitivity")}</span>',
    'aria-label={t(language, "sensitivity")}',
    '<span>{t(language, "outline")}</span>',
  ];
  const missingComponent = requiredComponent.filter((snippet) => !component.includes(snippet));
  if (missingComponent.length) {
    fail(`BackgroundControls must use localized accessible labels:\n${missingComponent.join("\n")}`);
  }
  if (component.includes("<span>Line</span>")) {
    fail("BackgroundControls must not hard-code the outline label.");
  }
}

function assertCustomCursorAcceptsDocumentedFormats() {
  const component = read("frontend/src/components/controls/CursorStyleControls.tsx");
  const readme = read("README.md");
  const expectedFormats = ["image/png", "image/gif", "image/apng", "video/webm"];
  const missingFormats = expectedFormats.filter((format) => !component.includes(format));
  if (missingFormats.length) {
    fail(`Custom cursor upload must accept the formats required by the development doc:\n${missingFormats.join("\n")}`);
  }
  if (!readme.includes("custom cursor uploads (PNG/GIF/APNG/WebP/WebM)")) {
    fail("README must document the custom cursor upload formats exposed by the reader.");
  }
}

function assertThemesAndResponsiveLayoutMatchDevelopmentDoc() {
  const types = read("frontend/src/types/index.ts");
  const theme = read("frontend/src/lib/theme.ts");
  const switcher = read("frontend/src/components/controls/ThemeSwitcher.tsx");
  const i18n = read("frontend/src/lib/i18n.ts");
  const css = read("frontend/src/styles/index.css");
  const expectedThemes = ["light", "dark", "sepia", "forest", "ocean", "sunset"];

  if (!types.includes('export type ThemeName = "dark" | "light" | "sepia" | "forest" | "ocean" | "sunset";')) {
    fail("ThemeName must enumerate the six development-doc themes.");
  }
  for (const name of expectedThemes) {
    if (!theme.includes(`name: "${name}"`)) {
      fail(`THEMES is missing theme: ${name}`);
    }
    const cssSelector = name === "dark" ? ":root {" : `html[data-theme="${name}"]`;
    if (!css.includes(cssSelector)) {
      fail(`CSS is missing theme variables for: ${name}`);
    }

    const selector = name === "dark" ? ":root" : `html[data-theme="${name}"]`;
    const vars = extractCssVariables(extractCssBlock(css, selector));
    for (const token of [
      "--bg",
      "--panel",
      "--text",
      "--muted",
      "--accent",
      "--on-accent",
      "--mask",
      "--page",
      "--page-text",
      "--page-muted",
      "--page-accent",
    ]) {
      if (!vars[token]) {
        fail(`CSS theme ${name} is missing color token: ${token}`);
      }
    }
    if (vars["--mask"] !== vars["--accent"]) {
      fail(`CSS theme ${name} must keep --mask aligned with --accent.`);
    }
    const contrastChecks = [
      ["--text", "--bg", "body text", 4.5],
      ["--text", "--panel", "panel text", 4.5],
      ["--muted", "--panel", "muted panel text", 4.5],
      ["--accent", "--bg", "accent text", 4.5],
      ["--on-accent", "--accent", "accent surface text", 4.5],
      ["--page-text", "--page", "reader text", 7],
      ["--page-muted", "--page", "reader secondary text", 7],
      ["--page-accent", "--page", "reader accent text", 4.5],
      ["--mask", "--page", "reader mask", 4.5],
    ];
    for (const [foreground, background, label, minimum] of contrastChecks) {
      const ratio = contrastRatio(vars[foreground], vars[background]);
      if (ratio < minimum) {
        fail(`CSS theme ${name} ${label} contrast is ${ratio.toFixed(2)} (< ${minimum}).`);
      }
    }
  }

  const canvasTextLayer = read("frontend/src/renderer/layers/TextLayer.ts");
  if (!canvasTextLayer.includes("colors.pageMuted") || !canvasTextLayer.includes("colors.pageAccent")) {
    fail("Canvas TextLayer must use semantic pageMuted/pageAccent colors for article roles.");
  }
  if (canvasTextLayer.includes("hexToRgba") || canvasTextLayer.includes("0.52")) {
    fail("Canvas TextLayer must not simulate low-emphasis article text with translucent page text.");
  }
  const swatchCount = (theme.match(/swatch:\s*"#[0-9a-fA-F]{6}"/g) ?? []).length;
  if (swatchCount !== expectedThemes.length) {
    fail(`Each theme must expose one swatch, found ${swatchCount}.`);
  }

  const labelKeys = ["themeDark", "themeLight", "themePaper", "themeForest", "themeOcean", "themeSunset"];
  for (const key of labelKeys) {
    const matches = i18n.match(new RegExp(`\\b${key}:`, "g")) ?? [];
    if (matches.length !== 2) {
      fail(`Theme label must have en and zh translations: ${key}`);
    }
    if (!switcher.includes(key)) {
      fail(`ThemeSwitcher must use localized theme label key: ${key}`);
    }
  }
  if (!switcher.includes("THEMES.map((item)") || !switcher.includes("aria-label={label}")) {
    fail("ThemeSwitcher must render all themes with accessible localized labels.");
  }

  const responsiveSnippets = [
    "@media (max-width: 920px)",
    "grid-template-columns: minmax(0, 1fr);",
    "width: min(330px, calc(100vw - 28px));",
    "column-count: 1 !important;",
    "@media (max-width: 560px)",
    "padding: 24px 18px;",
  ];
  const missingResponsive = responsiveSnippets.filter((snippet) => !css.includes(snippet));
  if (missingResponsive.length) {
    fail(`Responsive reader layout must preserve tablet/mobile single-column behavior:\n${missingResponsive.join("\n")}`);
  }
}

assertSameDictionaryKeys();
assertPlaceholderInputsAreNamed();
assertUploadProgressIsAccessible();
assertReadingProgressIsAccessible();
assertUserErrorsAreLocalized();
assertContentInputsDisableWhileLoading();
assertReaderLayoutControlsMatchDevelopmentDoc();
assertKeyboardShortcutsIgnoreEditingTargets();
assertFullscreenControlIsLocalized();
assertFullscreenModeUsesBrowserApi();
assertBackgroundControlsAreLocalizedAndNamed();
assertCustomCursorAcceptsDocumentedFormats();
assertThemesAndResponsiveLayoutMatchDevelopmentDoc();

console.log("Frontend source quality checks passed.");
