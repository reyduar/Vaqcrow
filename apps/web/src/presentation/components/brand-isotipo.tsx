import type { CSSProperties } from "react";

/**
 * The isotipo (`apps/web/public/vaqcrow-isotipo.png`, a white silhouette) is
 * drawn as a CSS mask so it takes the colour of its background, as the
 * template does (`-webkit-mask:url(assets/vaqcrow-isotipo.png) center/contain`).
 */
export const ISOTIPO_MASK: CSSProperties = {
  WebkitMask: "url(/vaqcrow-isotipo.png) center / contain no-repeat",
  mask: "url(/vaqcrow-isotipo.png) center / contain no-repeat"
};

/**
 * The header isotipo of `Vaqcrow Landing.dc.html` (33 × 32 px, `--logo`):
 * purple on the light theme, white on the dark one. Decorative: the brand
 * link that contains it carries the accessible name.
 */
export function BrandIsotipo() {
  return <span aria-hidden="true" data-brand-isotipo="" className="block h-8 w-[33px] shrink-0 bg-logo" style={ISOTIPO_MASK} />;
}
