import type { IconType } from "react-icons";
import {
  IoAddOutline,
  IoCubeOutline,
  IoGitNetworkOutline,
  IoKeyOutline,
  IoLayersOutline,
  IoMailOutline,
  IoRemoveOutline,
  IoSearchOutline,
  IoSparklesOutline
} from "react-icons/io5";

/**
 * The help-center copy stores the template's Ionicons names as plain strings
 * (`application/help/faq.ts` is React-free), so presentation owns the mapping
 * to `react-icons/io5` — the same module-level typed record pattern the repo
 * uses (`about/about-icons.ts`, `guides/guide-icons.ts`). A glyph resolves with
 * a direct index, never a component-creating call during render (which the
 * React Compiler lint forbids).
 */
export type HelpIconName =
  | "search-outline"
  | "layers-outline"
  | "key-outline"
  | "git-network-outline"
  | "cube-outline"
  | "add-outline"
  | "remove-outline"
  | "sparkles-outline"
  | "mail-outline";

export const HELP_ICONS: Readonly<Record<HelpIconName, IconType>> = Object.freeze({
  "search-outline": IoSearchOutline,
  "layers-outline": IoLayersOutline,
  "key-outline": IoKeyOutline,
  "git-network-outline": IoGitNetworkOutline,
  "cube-outline": IoCubeOutline,
  "add-outline": IoAddOutline,
  "remove-outline": IoRemoveOutline,
  "sparkles-outline": IoSparklesOutline,
  "mail-outline": IoMailOutline
});
