import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorState } from "./error-state";

/**
 * ErrorState primitive. Matches `Explorar PyMEs`' load-failure panel:
 * `role="alert"`, a visible title/message, and a retry action through the
 * shared `Button`. Meaning lives in the text, never only in the
 * `--color-trust-critical` tint.
 */
const meta = {
  title: "Estados/ErrorState",
  component: ErrorState,
  args: {
    title: "No pudimos cargar las campañas",
    message: "Revisá tu conexión e intentá de nuevo.",
    onRetry: () => {}
  }
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const CustomRetryLabel: Story = {
  args: { retryLabel: "Volver a intentar" }
};
