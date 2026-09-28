import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { microcopy } from "@/application/trust/disclosures";
import { SiteFooter } from "./site-footer";

/**
 * SiteFooter: the compact footer from `Vaqcrow Onboarding PyME.dc.html`. The
 * notice is the canonical `no-production` disclosure, rendered through
 * `CanonicalDisclosure`; the legal row is caller-supplied, and this story
 * passes the canonical `microcopy.testnetBadge` — never the template's
 * non-canonical `Stellar Testnet · Activos sin valor económico`.
 */
const meta = {
  title: "Navegación/SiteFooter",
  component: SiteFooter,
  args: {
    copyright: "Vaqcrow · 2026",
    environment: microcopy.testnetBadge
  }
} satisfies Meta<typeof SiteFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Without either legal string the row is omitted; the disclosure stays. */
export const WithoutLegalRow: Story = {
  render: () => <SiteFooter />
};
