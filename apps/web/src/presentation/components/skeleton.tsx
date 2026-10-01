"use client";

import { Skeleton as HeroSkeleton } from "@heroui/react";
import { useEffect, useState } from "react";

/**
 * Skeleton primitive (Issue #310 / T1). Wraps HeroUI's `Skeleton` so a loading
 * placeholder is always one accessible region: a single `role="status"`
 * wrapper carries a visually-hidden announcement (`label`), the decorative
 * shapes underneath are pulled out of the accessibility tree entirely
 * (`aria-hidden` on their container, not per-shape — an `aria-hidden`
 * ancestor already removes the whole subtree), and the animation itself is
 * disabled under `prefers-reduced-motion: reduce` rather than left to
 * HeroUI's default shimmer, which does not check that preference on its own.
 */
export type SkeletonShape = "line" | "block" | "card";

export interface SkeletonProps {
  /** Ordered list of placeholder shapes to render. Default: a single line. */
  readonly shapes?: readonly SkeletonShape[];
  /** Text announced to assistive tech while the region is present. */
  readonly label?: string;
  readonly className?: string;
}

const SHAPE_CLASS: Readonly<Record<SkeletonShape, string>> = {
  line: "h-3 w-full rounded-control bg-skel",
  block: "h-24 w-full rounded-control bg-skel",
  card: "h-40 w-full rounded-card bg-skel"
};

/**
 * True when the user's OS/browser requests reduced motion. jsdom (the unit
 * test environment) does not implement `matchMedia`, so this only runs in a
 * real browser or against an explicitly mocked `matchMedia`; the hook stays
 * inert (returns `false`) otherwise instead of throwing.
 */
function supportsMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function usePrefersReducedMotion(): boolean {
  // Lazy initializer instead of an effect-body setState: the initial read
  // only needs to run once, on mount, and setting state synchronously inside
  // an effect body triggers an avoidable cascading render.
  const [prefersReduced, setPrefersReduced] = useState(
    () => supportsMatchMedia() && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (!supportsMatchMedia()) {
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return prefersReduced;
}

export function Skeleton({ shapes = ["line"], label = "Cargando…", className }: SkeletonProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div role="status" {...(className ? { className } : {})}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        {shapes.map((shape, index) => (
          <HeroSkeleton
            key={`${shape}-${index}`}
            animationType={prefersReducedMotion ? "none" : "shimmer"}
            className={SHAPE_CLASS[shape]}
          />
        ))}
      </div>
    </div>
  );
}
