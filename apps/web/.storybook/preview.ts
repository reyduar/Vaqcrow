import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

/**
 * The toolbar drives the same `data-theme` attribute the app's bootstrap script
 * and the `ThemeSwitcher` set, so a story is reviewed under the real mechanism
 * instead of a parallel one. Both the app's tokens and HeroUI's stylesheet key
 * on that attribute, so a single marker is enough here.
 *
 * `a11y.test: "error"` only fails once stories are executed as tests; until the
 * Vitest addon is wired it reports in the panel and fails nothing. See
 * `docs/guides/storybook.md`.
 */
const preview: Preview = {
  parameters: {
    a11y: { test: "error" }
  },
  decorators: [
    withThemeByDataAttribute({
      themes: { Claro: "light", Oscuro: "dark" },
      defaultTheme: "Claro",
      attributeName: "data-theme"
    })
  ]
};

export default preview;
