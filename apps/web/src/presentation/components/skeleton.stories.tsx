import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";

/**
 * Skeleton primitive. One `role="status"` region per loading placeholder, a
 * visually-hidden announcement for assistive tech, and decorative shapes
 * pulled entirely out of the accessibility tree. The shimmer animation
 * disables itself under `prefers-reduced-motion: reduce` (only observable in
 * a real browser with that OS/browser preference set — Storybook's canvas
 * respects it too).
 */
const meta = {
  title: "Estados/Skeleton",
  component: Skeleton,
  args: { label: "Cargando…" }
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Line: Story = {
  args: { shapes: ["line"] }
};

export const Block: Story = {
  args: { shapes: ["block"] }
};

export const Card: Story = {
  args: { shapes: ["card"] }
};

/** A campaign-card skeleton: title line, body line, and the funding block. */
export const CardWithLines: Story = {
  args: { label: "Cargando campañas…", shapes: ["line", "line", "block"] }
};
