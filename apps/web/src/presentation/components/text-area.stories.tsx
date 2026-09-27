import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextArea } from "./text-area";

/**
 * TextArea primitive. Covers the required-reason pattern used by
 * `HumanDecisionForm`: a visible error when the required field is empty,
 * linked via `aria-describedby`, never only `aria-invalid`.
 */
const meta = {
  title: "Primitivas/TextArea",
  component: TextArea,
  args: { label: "Razón de la decisión" }
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithHelperText: Story = {
  args: { label: "Comentario", helperText: "Opcional, máximo 500 caracteres." }
};

export const RequiredWithError: Story = {
  args: { label: "Razón de la decisión", isRequired: true, error: "Campo obligatorio." }
};
