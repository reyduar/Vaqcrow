import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChipToggleGroup, type ChipToggleGroupOption } from "./chip-toggle-group";

/**
 * ChipToggleGroup primitive: multi-select pill chips (the template's sector
 * and risk-profile filters). Selected state is never colour-only — a
 * selected chip also shows a visible checkmark icon next to its label.
 */
const meta = {
  title: "Primitivas/ChipToggleGroup",
  component: ChipToggleGroup
} satisfies Meta<typeof ChipToggleGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

const SECTORS: readonly ChipToggleGroupOption[] = [
  { value: "alimentos", label: "Alimentos" },
  { value: "servicios", label: "Servicio automotor" },
  { value: "gastronomia", label: "Gastronomía" },
  { value: "comercio", label: "Comercio minorista" }
];

export const Unselected: Story = { args: { label: "Sector", options: SECTORS } };

export const WithSelection: Story = {
  args: { label: "Sector", options: SECTORS, defaultValue: ["alimentos", "gastronomia"] }
};

export const Disabled: Story = {
  args: { label: "Sector", options: SECTORS, defaultValue: ["alimentos"], isDisabled: true }
};

const RISK_LEVELS: readonly ChipToggleGroupOption[] = [
  { value: "bajo", label: "Bajo" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" }
];

export const RiskProfile: Story = {
  args: { label: "Perfil de riesgo", options: RISK_LEVELS, defaultValue: ["medio"] }
};
