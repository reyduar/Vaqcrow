import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CustodyNote } from "./custody-note";

/**
 * The vault (the contract, not a person) holds a campaign's funds. Renders
 * only canonical `disclosures.ts` copy through `CanonicalDisclosure` — no
 * new wording.
 */
const meta = {
  title: "Confianza/CustodyNote",
  component: CustodyNote,
  args: { lang: "es" }
} satisfies Meta<typeof CustodyNote>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ContractOnly: Story = {};

/** Funding step: a wallet signer (Freighter) is also in context. */
export const WithSigner: Story = {
  args: { includeSigner: true }
};
