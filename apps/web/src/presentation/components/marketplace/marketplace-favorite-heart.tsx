"use client";

import { IoHeart, IoHeartOutline } from "react-icons/io5";

/**
 * The marketplace favorite toggle (Feature #414, WU4b): a pill heart overlaid
 * top-right on a card. Presentational only — the caller owns the favorite
 * state and the write; this component only renders the pressed state and calls
 * `onToggle`. The accessible name says exactly what the action does, and the
 * filled/outline icon is a secondary hint, never the only signal.
 */
export interface MarketplaceFavoriteHeartProps {
  readonly isFavorite: boolean;
  readonly name: string;
  readonly onToggle: () => void;
}

export function MarketplaceFavoriteHeart({ isFavorite, name, onToggle }: MarketplaceFavoriteHeartProps) {
  const Icon = isFavorite ? IoHeart : IoHeartOutline;

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={`${isFavorite ? "Quitar de favoritos: " : "Agregar a favoritos: "}${name}`}
      onClick={onToggle}
      className="grid h-10 w-10 cursor-pointer place-items-center rounded-pill border border-border bg-canvas text-brand-accent-text transition-colors hover:bg-page-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <Icon aria-hidden="true" focusable="false" className="text-[19px]" />
    </button>
  );
}
