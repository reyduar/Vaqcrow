"use client";

import { useEffect, useState } from "react";
import type { GuideTocEntry } from "@/application/guides/types";
import { ProgressBar } from "../progress-bar";

/**
 * Sticky guide table of contents with a reading-progress indicator
 * (`Vaqcrow Guia emprendedores.dc.html` `:114-123`). The scroll progress and
 * the active entry are the only client state in the guide, so they live in
 * this small island; the sections themselves stay server-rendered. The bar is
 * the shipped `ProgressBar` primitive (react-aria `role="progressbar"`), not a
 * bespoke bar, and the island reads the same `[data-guide-body]` rect the
 * template's script uses to derive the percentage and the current anchor.
 */
export function GuideToc({ entries }: { readonly entries: readonly GuideTocEntry[] }) {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState(entries[0]?.id ?? "");

  useEffect(() => {
    const body = document.querySelector("[data-guide-body]");
    const ids = entries.map((entry) => entry.id);

    const update = () => {
      if (!body) return;
      const rect = body.getBoundingClientRect();
      const viewport = window.innerHeight;
      const raw = ((viewport * 0.4 - rect.top) / (rect.height - viewport * 0.6)) * 100;
      // Guard the degenerate rect jsdom (and a zero-height body) returns, so the
      // label never reads "NaN %".
      setProgress(Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0);

      let current = ids[0] ?? "";
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top < 140) current = id;
      }
      setActiveId(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [entries]);

  return (
    <nav
      aria-label="Índice de la guía"
      data-guide-toc=""
      className="flex flex-col gap-3.5 rounded-card border border-border p-5 lg:sticky lg:top-24"
    >
      <ProgressBar
        label="Tu lectura"
        ariaLabel="Progreso de lectura"
        value={progress}
        goal={100}
        formatValue={(value) => `${value} %`}
      />
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {entries.map((entry, index) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                {...(isActive ? { "aria-current": "location" as const } : {})}
                className={`flex min-h-9 items-center gap-2.5 rounded-control px-2.5 text-sm no-underline ${
                  isActive
                    ? "bg-brand-accent-tint font-[650] text-text-primary"
                    : "font-medium text-text-primary transition-colors hover:bg-page-surface"
                }`}
              >
                <span className="w-[18px] text-xs text-text-secondary">{String(index + 1).padStart(2, "0")}</span>
                <span>{entry.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
