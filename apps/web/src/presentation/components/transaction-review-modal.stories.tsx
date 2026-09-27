import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TransactionReviewModal, type TransactionReviewDescriptionRow } from "./transaction-review-modal";

/**
 * TransactionReviewModal: the "Revisión antes de firmar" overlay
 * (`claude-design-brief.md:218`, `demo-ui.md:460`/`:1173`). Fully
 * presentational and controlled — every value, state and handler here is a
 * prop, so these stories render with `isOpen` already true instead of
 * requiring a trigger interaction.
 *
 * `wrongNetworkMessage` and the acknowledgement checkbox's label are
 * caller-supplied: neither string lives in `application/trust`'s canonical
 * copy (recorded deviation in `odd/tasks/transaction-review-modal.md`), so
 * these stories are their only home in the demo today.
 */
const SYNTHETIC_SOURCE_ACCOUNT = "GDEMOACCTFAKESYNTHETICTESTNETONLYNOTREALSTELLARPUBKEY001";
const SYNTHETIC_VAULT_CONTRACT_ID = "CDEMOCONTRACTFAKESYNTHETICTESTNETONLYNOTREALVAULTID00001";
const ACK_LABEL = "Revisé la red, las cuentas, el activo, el monto y el memo";
const WRONG_NETWORK_MESSAGE = "Cambia a Stellar Testnet para continuar";

const ROWS: readonly TransactionReviewDescriptionRow[] = [
  { label: "Cuenta origen", value: SYNTHETIC_SOURCE_ACCOUNT, mono: true },
  { label: "Contrato de la bóveda", value: SYNTHETIC_VAULT_CONTRACT_ID, mono: true },
  { label: "Memo", value: "aporte-demo-001" }
];

/**
 * `signingStatus`/`isWrongNetwork` are now discriminated unions (native
 * review advisories R3-silent-rejection and parent readback finding #3): a
 * rejected status always pairs with `signingErrorMessage`, and
 * `isWrongNetwork: true` always pairs with `wrongNetworkMessage`. `meta.args`
 * below deliberately omits both `acknowledgementLabel` and any signing/network
 * override — under `exactOptionalPropertyTypes`, a per-story `args` override
 * can't set a field to `undefined` to "unset" a base default, so
 * `WithoutAcknowledgement` needing no checkbox is the *default* shape here,
 * and every other story adds `acknowledgementLabel` back explicitly instead.
 */
const meta = {
  title: "Overlays/TransactionReviewModal",
  component: TransactionReviewModal,
  args: {
    isOpen: true,
    onClose: () => undefined,
    onSign: () => undefined,
    title: "Fondeo de campaña",
    amount: "500",
    assetCode: "USDC-test",
    descriptionRows: ROWS,
    signingStatus: "idle"
  }
} satisfies Meta<typeof TransactionReviewModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Idle, with the acknowledgement checkbox required before signing. */
export const Default: Story = {
  args: { acknowledgementLabel: ACK_LABEL }
};

export const WithoutAcknowledgement: Story = {};

export const WrongNetwork: Story = {
  args: {
    acknowledgementLabel: ACK_LABEL,
    isWrongNetwork: true,
    wrongNetworkMessage: WRONG_NETWORK_MESSAGE
  }
};

export const Signing: Story = {
  args: { acknowledgementLabel: ACK_LABEL, signingStatus: "signing" }
};

export const SignatureRejected: Story = {
  args: {
    acknowledgementLabel: ACK_LABEL,
    signingStatus: "signature-rejected",
    signingErrorMessage: "Rechazaste la firma en Freighter."
  }
};

export const VerificationRejected: Story = {
  args: {
    acknowledgementLabel: ACK_LABEL,
    signingStatus: "verification-rejected",
    signingErrorMessage: "No pudimos verificar la transacción firmada."
  }
};

export const LongValues: Story = {
  args: {
    acknowledgementLabel: ACK_LABEL,
    title: "Fondeo de campaña con memo extenso y contrato de bóveda largo",
    descriptionRows: [
      ...ROWS,
      {
        label: "Destino permanente",
        value: "GLONGDESTINATIONACCOUNTFAKESYNTHETICTESTNETONLYNOTREAL0001",
        mono: true
      }
    ]
  }
};
