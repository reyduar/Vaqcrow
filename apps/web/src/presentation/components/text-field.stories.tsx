import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextField } from "./text-field";

/**
 * TextField primitive. Covers the states in the template's "Campos"
 * inventory: helper text, an invalid field with a visible error (never only
 * `aria-invalid`), a unit suffix that is visible and announced, and a
 * read-only field carrying the SIMULADO tag contiguous to its value.
 */
const meta = {
  title: "Primitivas/TextField",
  component: TextField,
  args: { label: "Período desde" }
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithHelperText: Story = {
  args: { helperText: "Formato AAAA-MM." }
};

export const Invalid: Story = {
  args: {
    label: "Período desde",
    helperText: "Formato AAAA-MM.",
    error: "Usá el formato AAAA-MM, por ejemplo 2026-01."
  }
};

export const WithUnitSuffix: Story = {
  args: { label: "Monto a aportar", value: "250", unit: "XLM" }
};

export const RequiredPercentage: Story = {
  args: { label: "Porcentaje del ingreso", value: "4,5", unit: "%", isRequired: true }
};

/** A read-only synthetic field: the SIMULADO tag travels contiguous to the value. */
export const ReadOnlySimulado: Story = {
  args: {
    label: "Razón social",
    value: "Panadería Horizonte SRL",
    isReadOnly: true,
    simuladoLabel: "SIMULADO"
  }
};
