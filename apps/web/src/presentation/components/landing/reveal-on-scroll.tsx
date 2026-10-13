"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The 「La traza」 section's single orchestrated moment (#497): the trace draws
 * itself the first time the section enters the viewport. It is the section's
 * only motion — there are no per-item fades.
 *
 * The children are **server-rendered**: this island only flips `data-revealed`
 * on its wrapper, so the section's copy never enters the client bundle. The
 * effect is an enhancement, never a requirement — without
 * `IntersectionObserver` (or if a browser ignores the transition) the trace
 * renders fully drawn, and `prefers-reduced-motion` removes the transition
 * through the CSS variants the project already uses.
 */
export interface RevealOnScrollProps {
  readonly children: ReactNode;
}

export function RevealOnScroll({ children }: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    // Without `IntersectionObserver` nothing is revealed, and that is fine: the
    // rail renders fully drawn by default, so the animation is never required.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-revealed={revealed ? "true" : undefined} className="group/traza">
      {children}
    </div>
  );
}
