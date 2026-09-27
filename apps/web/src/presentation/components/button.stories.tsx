import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button, type ButtonVariant } from "./button";

/**
 * Button primitive. The four variants map onto HeroUI's own vocabulary
 * (`primary`/`secondary`/`ghost`/`danger`). `isLoading` always swaps in a
 * visible label — never only a spinner — and a disabled button always shows
 * its reason as text, never only a tooltip.
 */
const meta = {
  title: "Primitivas/Button",
  component: Button,
  args: { variant: "primary", children: "Aportar a la campaña" }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "ghost", "destructive"];

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {VARIANTS.map((variant) => (
        <Button key={variant} variant={variant}>
          {variant === "destructive" ? "Rechazar solicitud" : "Continuar"}
        </Button>
      ))}
    </div>
  )
};

/** `isLoading` changes the visible label and disables the button. */
export const Loading: Story = {
  args: { isLoading: true, loadingLabel: "Enviando…", children: "Enviar solicitud" }
};

/**
 * Disabled with a visible reason: the text below is always rendered, linked
 * via `aria-describedby`, never only a tooltip on hover.
 */
export const DisabledWithReason: Story = {
  args: {
    isDisabled: true,
    disabledReason: "Completá el CUIT declarado para poder firmar.",
    children: "Firmar distribución"
  }
};

export const FullWidth: Story = {
  args: { fullWidth: true, children: "Registrar decisión" },
  parameters: { layout: "padded" }
};
