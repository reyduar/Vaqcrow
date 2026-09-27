import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ComboBox } from "./combo-box";

/**
 * ComboBox primitive: a filterable autocomplete picker, e.g. the template's
 * city field. Always shows a visible "no results" message instead of an
 * empty popover when nothing matches.
 */
const meta = {
  title: "Primitivas/ComboBox",
  component: ComboBox
} satisfies Meta<typeof ComboBox>;

export default meta;

type Story = StoryObj<typeof meta>;

const CITIES: readonly string[] = [
  "Córdoba",
  "Mendoza",
  "Rosario",
  "La Matanza",
  "Mar del Plata",
  "San Miguel de Tucumán"
];

export const Basic: Story = { args: { label: "Ciudad", items: CITIES, placeholder: "Buscá una ciudad" } };

export const WithSelectedValue: Story = { args: { label: "Ciudad", items: CITIES, defaultValue: "Rosario" } };

export const EmptyResults: Story = {
  args: {
    label: "Ciudad",
    items: CITIES,
    emptyResultsText: "No se encontraron ciudades."
  }
};

export const RequiredWithError: Story = {
  args: { label: "Ciudad", items: CITIES, isRequired: true, error: "Elegí una ciudad." }
};

export const Disabled: Story = {
  args: { label: "Ciudad", items: CITIES, defaultValue: "Córdoba", isDisabled: true }
};
