"use client";

import { Avatar as HeroAvatar } from "@heroui/react";

/**
 * Avatar primitive (Issue #306 / T2). Wraps HeroUI's `Avatar` compound
 * (`Avatar.Image`/`Avatar.Fallback`, itself `@radix-ui/react-avatar`) so
 * every avatar in the app always carries an accessible name derived from the
 * required `name` prop — the underlying `<img>` always gets a computed
 * `alt` ("required alt" as a guarantee of this primitive, not an optional
 * pass-through) and the initials fallback (shown automatically whenever the
 * image is missing or fails to load) is itself `aria-hidden`, since the full
 * name — not the two-letter initials — is the accessible name exposed via
 * `role="img"`/`aria-label` on the root. `isDecorative` switches that off
 * entirely (empty `alt`, no exposed name) for the case where the caller
 * already renders the same name as visible text next to the avatar, so it is
 * never announced twice.
 */
export interface AvatarProps {
  readonly name: string;
  readonly src?: string;
  readonly size?: "sm" | "md" | "lg";
  readonly color?: "default" | "accent" | "success" | "warning" | "danger";
  /** True when `name` is already rendered as visible text next to the avatar. */
  readonly isDecorative?: boolean;
  readonly className?: string;
}

function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

export function Avatar({ name, src, size, color, isDecorative = false, className }: AvatarProps) {
  const initials = initialsFrom(name);
  const namingProps = isDecorative
    ? ({ "aria-hidden": "true" } as const)
    : ({ role: "img", "aria-label": name } as const);

  return (
    <HeroAvatar
      {...(size ? { size } : {})}
      {...(color ? { color } : {})}
      {...(className ? { className } : {})}
      {...namingProps}
    >
      {src ? <HeroAvatar.Image src={src} alt={isDecorative ? "" : name} /> : null}
      <HeroAvatar.Fallback aria-hidden="true">{initials}</HeroAvatar.Fallback>
    </HeroAvatar>
  );
}
