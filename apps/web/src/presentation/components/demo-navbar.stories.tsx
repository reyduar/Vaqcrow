import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { DemoNavbar, type DemoNavItem } from "./demo-navbar";

/**
 * DemoNavbar: the sticky header from `Vaqcrow Onboarding PyME.dc.html`. The
 * brand asset is not in the repo, so the wordmark renders alone (see the
 * component doc). The labels below are synthetic navigation, never trust copy.
 */
const ITEMS: readonly DemoNavItem[] = [
  { label: "Registro de PyME", href: "/request", current: true },
  { label: "Mi campaña", href: "/portfolio" },
  { label: "Cómo funciona", href: "/#como-funciona" }
];

const LONG_ITEMS: readonly DemoNavItem[] = [
  { label: "Registro de PyME", href: "/request", current: true },
  { label: "Evaluación asistida por IA", href: "/ai-assessment" },
  { label: "Aprobación humana de la campaña", href: "/approval" },
  { label: "Fondeo de la bóveda en Testnet", href: "/funding" },
  { label: "Distribución por contrato", href: "/distribution" },
  { label: "Evidencia y hash verificable", href: "/evidence" }
];

const actionButton: ReactNode = (
  <button
    type="button"
    className="inline-flex h-9 items-center rounded-full border border-border px-3 text-sm font-medium"
  >
    Cuenta
  </button>
);

const meta = {
  title: "Navegación/DemoNavbar",
  component: DemoNavbar,
  args: { items: ITEMS }
} satisfies Meta<typeof DemoNavbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The active item carries `aria-current="page"` plus the 2px underline. */
export const Default: Story = {};

export const NoActiveItem: Story = {
  args: { items: ITEMS.map(({ label, href }) => ({ label, href })) }
};

export const LongLabelSet: Story = {
  args: { items: LONG_ITEMS }
};

/**
 * The collapsed state: a 380px container keeps the disclosure button visible
 * and the nav closed until it is pressed. The responsiveness is
 * container-based, so this renders as the mobile layout regardless of the
 * canvas width; the same buttons and ARIA state are what the jsdom test drives.
 */
export const CollapsedMobile: Story = {
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div style={{ width: 380 }}>
      <DemoNavbar items={args.items} />
    </div>
  )
};

/** The `actions` slot — where the `AccountMenu` from T2 will drop in. */
export const WithActions: Story = {
  args: { actions: actionButton }
};
