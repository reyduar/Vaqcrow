import type { Page } from "@playwright/test";
import { expect, test } from "./support/local-only";

/**
 * The role-aware header at desktop width, compared with the template's
 * `Vaqcrow Landing.dc.html` header: the primary nav stays on one line, the
 * theme switcher is three icon buttons and the Testnet badge reads `TESTNET`.
 * jsdom has no layout, so the single line is measured here.
 */
test.use({ viewport: { width: 1280, height: 800 } });

/**
 * Free width left in the primary nav: the width the flex row allots it minus
 * what its links need. `scrollWidth - clientWidth` cannot report spare room
 * (scrollWidth never drops below clientWidth), so the links are summed.
 * Waits for the webfont first, so the measure is of the real typeface.
 */
async function navSlack(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page
    .getByRole("banner")
    .first()
    .getByRole("navigation", { name: "Principal" })
    .evaluate((nav) => {
      const links = [...nav.children].reduce((sum, link) => sum + link.getBoundingClientRect().width, 0);
      return Math.floor(nav.getBoundingClientRect().width - links);
    });
}

/**
 * Widens every glyph run in the header by a fixed amount, independently of the
 * fonts and text rasteriser the OS has, so a macOS run sees what a platform
 * with wider text metrics shows. The header was once tuned to ~1 px of spare
 * room on macOS and overflowed by 22 px on the Linux CI runner (its text
 * renders ~4 % wider: ~33 px across the whole row). 0.03em on 14 px labels is
 * ~0.42 px per character, ~6 % of the nav labels' width and ~36 px across the
 * row, so this run fails wherever that Linux difference would.
 */
const WIDER_TEXT_CSS = "header * { letter-spacing: 0.03em !important; }";

test("the public header keeps its nav on one line at 1280 px, as in the template", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner").first();
  const links = header.getByRole("navigation", { name: "Principal" }).getByRole("link");
  await expect(links).toHaveText(["Explorar PyMEs", "Cómo funciona", "Para emprendedores", "Acerca de"]);

  const tops = new Set<number>();
  const heights: number[] = [];
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    tops.add(Math.round(box?.y ?? -1));
    heights.push(box?.height ?? 0);
  }
  // One line: every link starts at the same height and none wraps its own label.
  expect(tops.size).toBe(1);
  // And none is clipped: the nav fits without scrolling sideways.
  const [scrollWidth, clientWidth] = await header
    .getByRole("navigation", { name: "Principal" })
    .evaluate((nav) => [nav.scrollWidth, nav.clientWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth ?? 0);
  for (const height of heights) expect(height).toBeLessThanOrEqual(48);

  // Brand, nav and actions share the header's single row.
  const brandBox = await header.getByRole("link", { name: "Vaqcrow, inicio" }).boundingBox();
  const signUpBox = await header.getByRole("link", { name: "Crear cuenta" }).boundingBox();
  const navTop = [...tops][0] ?? -1;
  expect(Math.abs((brandBox?.y ?? 0) + (brandBox?.height ?? 0) / 2 - (navTop + (heights[0] ?? 0) / 2))).toBeLessThan(12);
  expect(Math.abs((signUpBox?.y ?? 0) - navTop)).toBeLessThan(12);

  await expect(header.getByText("TESTNET", { exact: true })).toBeVisible();
  const theme = header.getByRole("group", { name: "Tema" });
  await expect(theme.getByRole("button")).toHaveCount(3);
  await expect(theme.getByRole("button", { name: "Tema oscuro" })).toBeVisible();
});

test("the public header still fits on one line at 1280 px when text renders wider", async ({ page }, testInfo) => {
  await page.goto("/");
  const header = page.getByRole("banner").first();
  const nav = header.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link")).toHaveCount(4);

  const normalSlack = await navSlack(page);
  testInfo.annotations.push({ type: "nav-slack-px", description: `normal: ${normalSlack}` });

  await page.addStyleTag({ content: WIDER_TEXT_CSS });
  const widerSlack = await navSlack(page);
  testInfo.annotations.push({ type: "nav-slack-px", description: `wider text: ${widerSlack}` });

  // Nothing clipped or scrolled away with wider text, and every link on one row.
  expect(widerSlack).toBeGreaterThanOrEqual(0);
  const tops = new Set<number>();
  for (const link of await nav.getByRole("link").all()) {
    const box = await link.boundingBox();
    tops.add(Math.round(box?.y ?? -1));
  }
  expect(tops.size).toBe(1);
  await expect(header.getByRole("link", { name: "Crear cuenta" })).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole("link", { name: "Acerca de" })).toBeInViewport({ ratio: 1 });
});
