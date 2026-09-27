import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar } from "./avatar";

/**
 * Avatar primitive. The initials fallback shows whenever the image is
 * missing or fails to load; the full name is always the accessible name
 * unless `isDecorative` is set (when the same name is already visible as
 * text next to the avatar, e.g. in an account menu row).
 */
const meta = {
  title: "Primitivas/Avatar",
  component: Avatar,
  args: { name: "Panadería Horizonte SRL" }
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InitialsFallback: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Lucía Fernández" size="sm" />
      <Avatar name="Lucía Fernández" size="md" />
      <Avatar name="Lucía Fernández" size="lg" />
    </div>
  )
};

/** Missing/broken image sources fall back to the visible initials. */
export const BrokenImage: Story = {
  args: { name: "Café Tostadero del Paraná", src: "https://example.invalid/does-not-load.jpg" }
};

/**
 * Decorative mode: the name is already rendered as visible text next to the
 * avatar, so the avatar itself carries no separate accessible name.
 */
export const DecorativeWithAdjacentName: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Lucía Fernández" isDecorative />
      <div className="flex flex-col">
        <span className="text-sm font-medium">Lucía Fernández</span>
        <span className="text-xs text-muted">INVERSOR</span>
      </div>
    </div>
  )
};
