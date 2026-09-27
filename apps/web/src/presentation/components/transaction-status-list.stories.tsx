import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TransactionStatusList, type TransactionStatusItem } from "./transaction-status-list";

/**
 * TransactionStatusList: the "Estado de transacción" list from `Vaqcrow
 * Sistema.dc.html`. The pending ("Enviada") sentence is owned by the component
 * and sourced from `microcopy.submittedNotConfirmed`; the values below are
 * synthetic Testnet-style labels and timestamps, always caller-formatted.
 */
const demoItems: readonly TransactionStatusItem[] = [
  { state: "signed", detail: "14:02:11 · cuenta GBX4…Q7LM" },
  { state: "sent", detail: "14:02:19 · enviada a Testnet" }
];

const meta = {
  title: "Datos/TransactionStatusList",
  component: TransactionStatusList,
  args: {
    items: demoItems,
    subtitle: "Aporte a la bóveda · Stellar Testnet"
  }
} satisfies Meta<typeof TransactionStatusList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Signed and sent, still waiting for confirmation — the list's `aria-live` announces the eventual change. */
export const PendingConfirmation: Story = {};

export const Confirmed: Story = {
  args: {
    items: [...demoItems, { state: "confirmed", detail: "14:02:31 · ledger 1.284.551" }]
  }
};

export const Failed: Story = {
  args: {
    items: [...demoItems, { state: "failed", detail: "Saldo insuficiente" }]
  }
};

export const CustomHeadingLevel: Story = {
  args: { heading: "Estado de la operación", headingLevel: 2 }
};

export const WithoutDetails: Story = {
  args: { items: demoItems.map((item) => ({ state: item.state })) }
};

export const WithoutSubtitle: Story = {
  render: (args) => (
    <TransactionStatusList
      items={args.items}
      {...(args.heading ? { heading: args.heading } : {})}
      {...(args.headingLevel ? { headingLevel: args.headingLevel } : {})}
    />
  )
};
