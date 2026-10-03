import { expect, test } from "./support/local-only";

/**
 * The role-aware header at desktop width, compared with the template's
 * `Vaqcrow Landing.dc.html` header: the primary nav stays on one line, the
 * theme switcher is three icon buttons and the Testnet badge reads `TESTNET`.
 * jsdom has no layout, so the single line is measured here.
 */
test.use({ viewport: { width: 1280, height: 800 } });

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
