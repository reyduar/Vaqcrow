import { expect, test } from "./support/local-only";

/**
 * #501: text must not overflow its container, on any screen, at any width.
 *
 * The reported defect was the campaign detail's funding badge row, where
 * `TESTNET · Activos sin valor económico` ran past the card's right edge. This
 * is the app-wide guard: for each screen and each width it asserts no element
 * sticks out past the document's client width, so the page never scrolls
 * sideways.
 *
 * It catches the reported class (an un-wrapped row pushing a long label out)
 * without pretending to be a design review: `docs/design/demo-ui.md` §2 still
 * asks for a human eye on the layout, and an element overflowing its own card
 * *inside* the viewport would slip past this check.
 *
 * The signed-in screens (`/company`, `/portfolio`, `/reports`, `/admin`) are
 * not covered here: they need a session, and the e2e suite runs as a guest.
 */
const SCREENS: readonly { readonly name: string; readonly path: string }[] = [
  { name: "landing", path: "/" },
  { name: "explore", path: "/explore" },
  { name: "campaign detail (example)", path: "/campaigns/example" },
  { name: "about", path: "/about" },
  { name: "help", path: "/help" },
  { name: "investor guide", path: "/investor-guide" },
  { name: "entrepreneur guide", path: "/entrepreneur-guide" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" }
];

const WIDTHS = [375, 768, 1280] as const;

for (const screen of SCREENS) {
  for (const width of WIDTHS) {
    test(`${screen.name} does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(screen.path);
      // Measure the real typeface, not the fallback.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const offenders = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;

        /** An ancestor that clips or scrolls means the element cannot push the page sideways. */
        function isContained(element: Element): boolean {
          let parent = element.parentElement;
          while (parent !== null && parent !== document.documentElement) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (overflowX === "hidden" || overflowX === "clip" || overflowX === "auto" || overflowX === "scroll") {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        }

        return [...document.querySelectorAll("body *")]
          .filter((element) => {
            // Decorative layers are positioned off-canvas on purpose.
            if (element.getAttribute("aria-hidden") === "true") return false;
            const box = element.getBoundingClientRect();
            if (box.width === 0 || box.right <= limit + 1) return false;
            return !isContained(element);
          })
          .slice(0, 5)
          .map((element) => `${element.tagName.toLowerCase()} .${String(element.className).slice(0, 80)}`);
      });

      expect(offenders).toEqual([]);
    });
  }
}
