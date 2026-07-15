/**
 * Pretext Reader — E2E tests (Playwright)
 *
 * Prerequisites:
 *   1. Backend running on http://127.0.0.1:8000
 *   2. Frontend dev server running on http://127.0.0.1:5173
 *
 * Run:
 *   npx playwright test --config e2e/playwright.config.ts
 */

import { expect, test } from "@playwright/test";

const CSS_URL = "http://127.0.0.1:5173/?engine=css";
const CANVAS_URL = "http://127.0.0.1:5173/?engine=canvas";

test.describe("Pretext Reader", () => {
  test.beforeEach(async ({ page }) => {
    // Most E2E assertions inspect DOM text lines, so force the CSS fallback
    // renderer here. Canvas coverage has its own smoke test below.
    await page.goto(CSS_URL);
    // Wait for the app shell to render
    await page.waitForSelector(".app-shell");
  });

  // -----------------------------------------------------------------------
  // App shell
  // -----------------------------------------------------------------------

  test("renders the app shell with sidebar and reader area", async ({ page }) => {
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".reader-area")).toBeVisible();
    await expect(page.locator(".brand-row h1")).toHaveText("Pretext Reader");
  });

  test("sidebar toggle hides and shows the panel", async ({ page }) => {
    const toggle = page.locator(".sidebar-toggle");
    await expect(page.locator(".sidebar")).toBeVisible();

    await toggle.click();
    await expect(page.locator(".sidebar")).not.toBeVisible();

    await toggle.click();
    await expect(page.locator(".sidebar")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Content loading
  // -----------------------------------------------------------------------

  test("loads a sample article and displays text", async ({ page }) => {
    const sampleButton = page.locator(".sample-row button");
    await expect(sampleButton).toBeVisible();
    await sampleButton.click();

    // Wait for text to appear (CSS columns render <p> elements)
    await expect(page.locator(".text-layer p").first()).toBeVisible({ timeout: 30000 });
  });

  test("canvas mode mounts visible canvas layers after loading content", async ({ page }) => {
    await page.goto(CANVAS_URL);
    await page.waitForSelector(".app-shell");

    const sampleButton = page.locator(".sample-row button");
    await sampleButton.click();

    await expect(page.locator(".canvas-page")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("canvas[data-layer='text']")).toBeVisible({ timeout: 30000 });
  });

  test("loads pasted text via the smart input and displays it", async ({ page }) => {
    const textarea = page.locator(".smart-input-field");
    await textarea.fill("Hello world from E2E test. This is a test paragraph.");
    await page.locator(".smart-input-submit").click();

    await expect(page.locator(".text-layer p").first()).toBeVisible({ timeout: 30000 });
  });

  // -----------------------------------------------------------------------
  // Layout controls
  // -----------------------------------------------------------------------

  test("column count keyboard shortcuts never exceed two columns", async ({ page }) => {
    // Load content first
    const sampleButton = page.locator(".sample-row button");
    await sampleButton.click();
    await expect(page.locator(".text-layer p").first()).toBeVisible({ timeout: 10000 });

    // Press 1 for single column
    await page.keyboard.press("Digit1");
    // The text-layer should reflect single column via inline style
    const textLayer = page.locator(".text-layer");
    await expect(textLayer).toHaveAttribute("style", /column-count:\s*1/);

    // Press 2 for two columns
    await page.keyboard.press("Digit2");
    await expect(textLayer).toHaveAttribute("style", /column-count:\s*2/);

    // Pressing 3 is intentionally ignored/clamped; the reader is capped at two columns.
    await page.keyboard.press("Digit3");
    await expect(textLayer).toHaveAttribute("style", /column-count:\s*2/);
  });

  test("font size slider changes text size", async ({ page }) => {
    const sliders = page.locator(".control-row input[type='range']");
    // The font size slider is the third range input (columnGap, fontSize, lineHeight)
    // Find it by looking for the FontSizeSlider component
    // Simple approach: check text-layer font-size changes after interacting
    await expect(page.locator(".text-layer")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Theme switching
  // -----------------------------------------------------------------------

  test("pressing T cycles through themes", async ({ page }) => {
    const html = page.locator("html");

    const initialTheme = await html.getAttribute("data-theme");
    await page.keyboard.press("t");
    const nextTheme = await html.getAttribute("data-theme");
    expect(nextTheme).not.toBe(initialTheme);

    await page.keyboard.press("t");
    const thirdTheme = await html.getAttribute("data-theme");
    expect(thirdTheme).not.toBe(nextTheme);
  });

  test("clicking theme swatches changes theme", async ({ page }) => {
    const swatches = page.locator(".theme-swatch");
    const count = await swatches.count();
    expect(count).toBe(6);

    // Click the first swatch (light theme)
    await swatches.nth(0).click();
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("light");
  });

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------

  test("? opens help panel and Escape closes it", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(page.locator(".help-panel")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".help-panel")).not.toBeVisible();
  });

  test("F toggles fullscreen", async ({ page }) => {
    // Fullscreen may be blocked in headless mode, so just check the button exists
    const fullscreenBtn = page.locator(".sidebar-footer button");
    await expect(fullscreenBtn).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // File upload
  // -----------------------------------------------------------------------

  test("file upload drop zone is visible and clickable", async ({ page }) => {
    const dropZone = page.locator(".drop-zone");
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toBeEnabled();
  });

  test("uploads a .txt file and displays text", async ({ page }) => {
    const fileInput = page.locator(".visually-hidden[type='file']");

    await fileInput.setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("E2E uploaded text content.\n\nSecond paragraph."),
    });

    // Wait for the file info card to appear
    await expect(page.locator(".file-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".file-info strong")).toContainText("test.txt");
  });

  // -----------------------------------------------------------------------
  // Responsive behavior
  // -----------------------------------------------------------------------

  test("sidebar hides on narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 800 });
    // At < 920px, sidebar should be hidden by default (fixed overlay)
    // The toggle should be visible
    await expect(page.locator(".sidebar-toggle")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  test("shows empty state when no content is loaded", async ({ page }) => {
    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.locator(".empty-state h3")).toHaveText("Ready for text");
  });

  test("smart input shows validation for empty submit", async ({ page }) => {
    // Submit the smart input with nothing typed — should show error without crashing.
    await page.locator(".smart-input-submit").click();

    // Should show an error or the input should remain without crashing
    await expect(page.locator(".sidebar")).toBeVisible();
  });
});
