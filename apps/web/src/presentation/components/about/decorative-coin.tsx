import type { CSSProperties } from "react";
import { ISOTIPO_MASK } from "../brand-isotipo";

const COIN_GRADIENT = "radial-gradient(circle at 32% 28%, #b24edf 0%, #8a05be 50%, #6e039a 100%)";

/**
 * The purple "coin" the template scatters around `/about` (`Vaqcrow Acerca
 * de.dc.html` `:69`, `:70`, `:87`, `:158-160`): a bevelled sphere with the
 * isotipo embossed on its face.
 *
 * Purely ornamental, so — as the template already states — it is always
 * `aria-hidden` and `pointer-events-none`, and the caller positions it behind
 * the content (`z-0`, content at `z-10`) so it never sits over an interactive
 * element. `data-decorative-coin` is the hook the page test uses to prove both
 * invariants across every instance.
 */
export interface DecorativeCoinProps {
  /** Diameter in pixels, matching the template's per-instance size. */
  readonly size: number;
  readonly rotate?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function DecorativeCoin({ size, rotate = 0, className = "", style }: DecorativeCoinProps) {
  return (
    <span
      aria-hidden="true"
      data-decorative-coin=""
      className={`pointer-events-none absolute z-0 block rounded-full ${className}`.trim()}
      style={{
        width: size,
        height: size,
        transform: `rotate(${rotate}deg)`,
        background: COIN_GRADIENT,
        boxShadow:
          "0 21px 53px -15px rgba(17,17,17,.35), inset -7px -9px 18px rgba(40,0,60,.35), inset 6px 7px 13px rgba(255,255,255,.25)",
        ...style
      }}
    >
      <span className="absolute inset-[22%] block bg-brand-accent-tint" style={ISOTIPO_MASK} />
    </span>
  );
}
