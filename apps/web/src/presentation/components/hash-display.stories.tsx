import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HashDisplay } from "./hash-display";

/**
 * A Testnet transaction hash or contract id: middle-truncated for reading,
 * full value on `title`/for assistive tech, copyable, and always carrying
 * the canonical TESTNET context. Synthetic hash only — never a real key or
 * seed.
 */
const SYNTHETIC_TX_HASH = "9c4e2a71f0b3d85e6a1c7f29b04d3e8a5f6c1b72d9e04a3f8b6c2d1e7a9f0b35";
const SYNTHETIC_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC7Q4K";

const meta = {
  title: "Confianza/HashDisplay",
  component: HashDisplay,
  args: {
    label: "Hash de transacción",
    value: SYNTHETIC_TX_HASH
  }
} satisfies Meta<typeof HashDisplay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TransactionHash: Story = {};

export const ContractId: Story = {
  args: { label: "Contrato", value: SYNTHETIC_CONTRACT_ID }
};

export const WithExplorerLink: Story = {
  args: {
    explorerUrl: "https://stellar.expert/explorer/testnet/tx/9c4e2a71f0b3d85e6a1c7f29b04d3e8a5f6c1b72d9e04a3f8b6c2d1e7a9f0b35"
  }
};

/** Two links in one section stay distinguishable: `proofLabel` names what each one proves. */
export const WithProofLabel: Story = {
  args: {
    label: "Contrato",
    value: SYNTHETIC_CONTRACT_ID,
    proofLabel: "Contrato de la bóveda",
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${SYNTHETIC_CONTRACT_ID}`
  }
};

/** A value short enough that middle-truncation would not help renders in full. */
export const ShortValue: Story = {
  args: { label: "Contrato", value: "CDLZ7Q4K" }
};
