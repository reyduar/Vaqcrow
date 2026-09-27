import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select, type SelectOption } from "./select";

/**
 * Select primitive: a fixed-option picker, e.g. the SME's province. Follows
 * the same label/helper/error shape as `TextField` — error XOR helper text,
 * never both.
 */
const meta = {
  title: "Primitivas/Select",
  component: Select
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

const PROVINCES: readonly SelectOption[] = [
  { value: "cordoba", label: "Córdoba" },
  { value: "mendoza", label: "Mendoza" },
  { value: "santa-fe", label: "Santa Fe" },
  { value: "buenos-aires", label: "Buenos Aires" },
  { value: "tucuman", label: "Tucumán" }
];

export const Basic: Story = {
  args: { label: "Provincia", placeholder: "Elegí una provincia", options: PROVINCES }
};

export const WithSelectedValue: Story = {
  args: { label: "Provincia", options: PROVINCES, defaultValue: "cordoba" }
};

export const WithHelperText: Story = {
  args: {
    label: "Provincia",
    placeholder: "Elegí una provincia",
    options: PROVINCES,
    helperText: "Usada para estimar el riesgo regional."
  }
};

export const RequiredWithError: Story = {
  args: {
    label: "Provincia",
    placeholder: "Elegí una provincia",
    options: PROVINCES,
    isRequired: true,
    error: "Elegí una provincia."
  }
};

export const Disabled: Story = {
  args: { label: "Provincia", options: PROVINCES, defaultValue: "mendoza", isDisabled: true }
};
