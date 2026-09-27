import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Slider } from "./slider";

/**
 * Slider primitive: the template's goal-amount and close-date range
 * controls. `formatValue` renders the visible/announced text — a unit
 * (XLM) or a formatted date — since values themselves stay numeric.
 */
const meta = {
  title: "Primitivas/Slider",
  component: Slider,
  args: { label: "Monto objetivo", minValue: 0, maxValue: 100, defaultValue: 30 }
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithUnit: Story = {
  args: {
    label: "Monto a aportar",
    minValue: 0,
    maxValue: 500,
    step: 10,
    defaultValue: 100,
    formatValue: (value) => `${value} XLM`
  }
};

const MIN_DAYS = 30;
const MAX_DAYS = 150;

function formatCloseDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/** The template's "fecha de cierre" slider: a day-count value formatted as a date. */
export const DateFormatted: Story = {
  args: {
    label: "Fecha de cierre",
    minValue: MIN_DAYS,
    maxValue: MAX_DAYS,
    step: 15,
    defaultValue: 60,
    formatValue: formatCloseDate
  }
};

export const Range: Story = {
  args: {
    label: "Rango de monto",
    minValue: 0,
    maxValue: 1000,
    step: 50,
    defaultValue: [100, 500],
    formatValue: (value) => `${value} XLM`
  }
};

export const Disabled: Story = { args: { isDisabled: true } };
