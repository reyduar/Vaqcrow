import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressBar } from "./progress-bar";

const formatArs = (value: number, goal: number) =>
  `$${value.toLocaleString("es-AR")} de $${goal.toLocaleString("es-AR")}`;

/**
 * ProgressBar primitive. Matches the funding progress bar on every campaign
 * card in the template: `role="progressbar"`, a visible label, and the
 * current value / goal spelled out as text via `formatValue` — never a
 * currency computation inside the component. "In progress" never uses the
 * success colour; only `isGoalReached` (set explicitly by the caller) does.
 */
const meta = {
  title: "Estados/ProgressBar",
  component: ProgressBar,
  args: {
    label: "Progreso de fondeo",
    value: 630000,
    goal: 1000000,
    formatValue: formatArs
  }
} satisfies Meta<typeof ProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const JustStarted: Story = {
  args: { value: 50000 }
};

/** Overfunded: the fill clamps visually to 100%, the text still shows the real value. */
export const Overfunded: Story = {
  args: { value: 1450000 }
};

/** Only an explicit, caller-confirmed goal switches the fill to the success colour. */
export const GoalReached: Story = {
  args: { value: 1000000, isGoalReached: true }
};
