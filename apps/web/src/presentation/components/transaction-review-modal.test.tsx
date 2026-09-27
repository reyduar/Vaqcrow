import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { microcopy } from "@/application/trust/disclosures";
import {
  TransactionReviewModal,
  type TransactionReviewDescriptionRow,
  type TransactionReviewModalProps,
  type TransactionReviewNetworkState,
  type TransactionReviewSigningState,
  type TransactionReviewSigningStatus
} from "./transaction-review-modal";

const SOURCE_ACCOUNT = "GDEMOACCTFAKESYNTHETICTESTNETONLYNOTREALSTELLARPUBKEY001";
const VAULT_CONTRACT_ID = "CDEMOCONTRACTFAKESYNTHETICTESTNETONLYNOTREALVAULTID00001";

const ROWS: readonly TransactionReviewDescriptionRow[] = [
  { label: "Cuenta origen", value: SOURCE_ACCOUNT, mono: true },
  { label: "Contrato de la bóveda", value: VAULT_CONTRACT_ID, mono: true },
  { label: "Memo", value: "aporte-demo-001" }
];

interface RenderOverrides {
  readonly isOpen?: boolean;
  readonly onClose?: () => void;
  readonly onSign?: () => void;
  readonly title?: string;
  readonly amount?: string;
  readonly assetCode?: string;
  readonly descriptionRows?: readonly TransactionReviewDescriptionRow[];
  readonly isWrongNetwork?: boolean;
  readonly wrongNetworkMessage?: string;
  readonly acknowledgementLabel?: string;
  readonly signingStatus?: TransactionReviewSigningStatus;
  readonly signingErrorMessage?: string;
}

function buildElement(overrides: RenderOverrides, onClose: () => void, onSign: () => void) {
  // Each union slice is built as a normal, fully-typed variable (one whole
  // object per branch) rather than spread conditionally piece-by-piece into
  // the JSX call — a conditional spread of just `isWrongNetwork` (or just
  // `signingStatus`) can't prove the paired field is complete under a
  // discriminated union, which is exactly the shape TypeScript now enforces.
  const networkProps: TransactionReviewNetworkState = overrides.isWrongNetwork
    ? {
        isWrongNetwork: true,
        wrongNetworkMessage: overrides.wrongNetworkMessage ?? "Cambia a Stellar Testnet para continuar"
      }
    : { isWrongNetwork: false };

  const isRejectedStatus =
    overrides.signingStatus === "signature-rejected" || overrides.signingStatus === "verification-rejected";
  const signingProps: TransactionReviewSigningState = isRejectedStatus
    ? {
        signingStatus: overrides.signingStatus as "signature-rejected" | "verification-rejected",
        signingErrorMessage: overrides.signingErrorMessage ?? "Ocurrió un problema con la firma."
      }
    : { signingStatus: (overrides.signingStatus as "idle" | "signing" | undefined) ?? "idle" };

  return (
    <TransactionReviewModal
      isOpen={overrides.isOpen ?? true}
      onClose={onClose}
      onSign={onSign}
      title={overrides.title ?? "Fondeo de campaña"}
      amount={overrides.amount ?? "500"}
      assetCode={overrides.assetCode ?? "USDC-test"}
      descriptionRows={overrides.descriptionRows ?? ROWS}
      {...networkProps}
      {...signingProps}
      {...(overrides.acknowledgementLabel !== undefined
        ? { acknowledgementLabel: overrides.acknowledgementLabel }
        : {})}
    />
  );
}

function renderModal(overrides: RenderOverrides = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onSign = overrides.onSign ?? vi.fn();

  const view = render(buildElement(overrides, onClose, onSign));

  return {
    onClose,
    onSign,
    rerender: (next: RenderOverrides) => view.rerender(buildElement(next, onClose, onSign))
  };
}

describe("TransactionReviewModal", () => {
  it("renders nothing while closed", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible dialog labelled by the caller-supplied title, with the eyebrow visible", () => {
    renderModal({ title: "Fondeo de campaña" });

    // HeroUI v3's `Modal.Dialog` (react-aria-components' `Dialog`) never
    // renders `aria-modal`: `useDialog` deliberately omits it (a documented
    // Safari/VoiceOver focus bug with iframes) and relies on `aria-hidden`
    // over the rest of the tree instead. `role="dialog"` and the
    // `aria-labelledby` wiring below are what this component can and does
    // guarantee; see the task log for the recorded deviation.
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAccessibleName("Fondeo de campaña");
    expect(screen.getByText("Revisión antes de firmar")).toBeInTheDocument();
  });

  it("renders the amount and asset code prominently beside the canonical no-value notice", () => {
    renderModal({ amount: "500", assetCode: "USDC-test" });

    expect(screen.getByText("500", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("USDC-test")).toBeInTheDocument();
    expect(screen.getByText(microcopy.testAssetNoValue)).toBeInTheDocument();
  });

  it("renders every caller-supplied description row, truncating long mono values but exposing them in full to assistive tech", () => {
    renderModal();

    expect(screen.getByText("Memo")).toBeInTheDocument();
    expect(screen.getByText("aporte-demo-001")).toBeInTheDocument();

    expect(screen.getByText("Cuenta origen")).toBeInTheDocument();
    const hiddenSource = screen.getByText(SOURCE_ACCOUNT);
    expect(hiddenSource).toHaveClass("sr-only");

    expect(screen.getByText("Contrato de la bóveda")).toBeInTheDocument();
    const hiddenContract = screen.getByText(VAULT_CONTRACT_ID);
    expect(hiddenContract).toHaveClass("sr-only");
  });

  it("always shows the Stellar Testnet network context", () => {
    renderModal();

    expect(screen.getByText("Stellar Testnet")).toBeInTheDocument();
  });

  it("shows no wrong-network message and leaves signing enabled by default", () => {
    renderModal();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Firmar en Freighter" })).toBeEnabled();
  });

  it("blocks signing and shows the caller-supplied message on the wrong network", () => {
    renderModal({ isWrongNetwork: true, wrongNetworkMessage: "Cambia a Stellar Testnet para continuar" });

    expect(screen.getByRole("alert")).toHaveTextContent("Cambia a Stellar Testnet para continuar");
    expect(screen.getByRole("button", { name: "Firmar en Freighter" })).toBeDisabled();
  });

  it("R3-empty-wrong-network-message: falls back to the canonical wrongNetwork message when the caller's message is empty", () => {
    renderModal({ isWrongNetwork: true, wrongNetworkMessage: "" });

    expect(screen.getByRole("alert")).toHaveTextContent(microcopy.wrongNetwork);
    expect(screen.getByRole("button", { name: "Firmar en Freighter" })).toBeDisabled();
  });

  it("R3-empty-wrong-network-message: falls back to the canonical wrongNetwork message when the caller's message is whitespace-only", () => {
    renderModal({ isWrongNetwork: true, wrongNetworkMessage: "   " });

    expect(screen.getByRole("alert")).toHaveTextContent(microcopy.wrongNetwork);
    expect(screen.getByRole("button", { name: "Firmar en Freighter" })).toBeDisabled();
  });

  it("R3-untyped-wrong-network-trim: falls back to the canonical wrongNetwork message when an untyped caller omits the message", () => {
    // Storybook controls or plain JS can flip isWrongNetwork without the paired message.
    const untypedNetworkProps = { isWrongNetwork: true } as unknown as TransactionReviewNetworkState;
    render(
      <TransactionReviewModal
        isOpen
        onClose={vi.fn()}
        onSign={vi.fn()}
        title="Fondeo de campaña"
        amount="500"
        assetCode="USDC-test"
        descriptionRows={ROWS}
        signingStatus="idle"
        {...untypedNetworkProps}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(microcopy.wrongNetwork);
    expect(screen.getByRole("button", { name: /Firmar en Freighter/ })).toBeDisabled();
  });

  it("R3-empty-wrong-network-message: residual limitation — a rejected status with an empty signingErrorMessage still renders an alert with no visible reason (no canonical fallback was authorized for this case; the type already requires the field, but not that it be non-empty)", () => {
    renderModal({ signingStatus: "signature-rejected", signingErrorMessage: "" });

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("");
  });

  it("renders the canonical pre-sign check and non-custody disclosure from the shared constants", () => {
    renderModal();

    expect(screen.getByText(microcopy.preSignCheck)).toBeInTheDocument();
    const disclosure = screen.getByRole("note");
    expect(within(disclosure).getByText("Firma no custodial")).toBeInTheDocument();
    expect(within(disclosure).getByText(/Freighter es la wallet/)).toBeInTheDocument();
  });

  it("renders no acknowledgement checkbox when acknowledgementLabel is not provided", () => {
    renderModal();

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Firmar en Freighter" })).toBeEnabled();
  });

  it("requires the acknowledgement checkbox before signing is enabled", () => {
    renderModal({ acknowledgementLabel: "Revisé la red, las cuentas, el activo, el monto y el memo" });

    const checkbox = screen.getByRole("checkbox", {
      name: "Revisé la red, las cuentas, el activo, el monto y el memo"
    });
    const signButton = screen.getByRole("button", { name: "Firmar en Freighter" });

    expect(checkbox).not.toBeChecked();
    expect(signButton).toBeDisabled();

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(signButton).toBeEnabled();
  });

  it("calls onSign when the enabled sign button is pressed", () => {
    const { onSign } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Firmar en Freighter" }));

    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it("shows a busy sign button while signing, changing its visible label and never implying confirmation", () => {
    renderModal({ signingStatus: "signing" });

    const busyButton = screen.getByRole("button", { name: /Firmando en Freighter/ });
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    expect(busyButton).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Firmar en Freighter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the caller-supplied message for a rejected signature without implying confirmation", () => {
    renderModal({ signingStatus: "signature-rejected", signingErrorMessage: "Rechazaste la firma en Freighter." });

    expect(screen.getByRole("alert")).toHaveTextContent("Rechazaste la firma en Freighter.");
    expect(screen.queryByText(/confirmad/i)).not.toBeInTheDocument();
  });

  it("shows the caller-supplied message for a rejected verification without implying confirmation", () => {
    renderModal({
      signingStatus: "verification-rejected",
      signingErrorMessage: "No pudimos verificar la transacción firmada."
    });

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos verificar la transacción firmada.");
    expect(screen.queryByText(/confirmad/i)).not.toBeInTheDocument();
  });

  it("R3-silent-rejection: a rejected signing status always shows its message via role=alert (enforced by the type)", () => {
    renderModal({ signingStatus: "signature-rejected", signingErrorMessage: "Rechazaste la firma en Freighter." });

    expect(screen.getByRole("alert")).toHaveTextContent("Rechazaste la firma en Freighter.");
  });

  it("closes on Escape", () => {
    const { onClose } = renderModal();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when Cancelar is pressed", () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the close button is pressed", () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets the acknowledgement checkbox and disables signing again on the next opening", () => {
    const ackLabel = "Revisé la red, las cuentas, el activo, el monto y el memo";
    const { rerender } = renderModal({ acknowledgementLabel: ackLabel });

    fireEvent.click(screen.getByRole("checkbox", { name: ackLabel }));
    expect(screen.getByRole("checkbox", { name: ackLabel })).toBeChecked();
    expect(screen.getByRole("button", { name: "Firmar en Freighter" })).toBeEnabled();

    rerender({ isOpen: false, acknowledgementLabel: ackLabel });
    rerender({ isOpen: true, acknowledgementLabel: ackLabel });

    expect(screen.getByRole("checkbox", { name: ackLabel })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Firmar en Freighter" })).toBeDisabled();
  });

  it("renders each description row as exactly one dt paired with one dd, and keeps a single TESTNET badge in the dialog", () => {
    renderModal();

    // HeroUI's `Modal` portals the dialog onto `document.body`, outside the
    // element `render()` returns as `container` — query the whole document
    // (as `screen` itself does) rather than `container`.
    const dl = document.body.querySelector("dl");
    expect(dl).not.toBeNull();

    const groups = Array.from(dl?.children ?? []);
    expect(groups).toHaveLength(ROWS.length);
    groups.forEach((group) => {
      expect(group.querySelectorAll("dt")).toHaveLength(1);
      expect(group.querySelectorAll("dd")).toHaveLength(1);
    });

    // Long mono values stay accessible in full even though the visible glyph
    // is truncated — see the "renders every caller-supplied description row"
    // test above for the truncation assertion itself.
    expect(screen.getByText(SOURCE_ACCOUNT)).toHaveClass("sr-only");
    expect(screen.getByText(VAULT_CONTRACT_ID)).toHaveClass("sr-only");

    // Exactly the network row's own badge — no per-row TESTNET badge.
    expect(document.body.querySelectorAll('[data-variant="testnet"]')).toHaveLength(1);
  });

  it("keeps the mono description values copyable", () => {
    renderModal();

    const copyButtons = screen.getAllByRole("button", { name: /copiar/i });
    expect(copyButtons.length).toBeGreaterThanOrEqual(2);
  });
});

describe("TransactionReviewModal prop types", () => {
  it("requires wrongNetworkMessage whenever isWrongNetwork is true (compile-time contract)", () => {
    // @ts-expect-error isWrongNetwork: true must be paired with wrongNetworkMessage under the
    // discriminated union — this object is intentionally invalid to prove the type rejects it.
    const invalid: TransactionReviewModalProps = {
      isOpen: true,
      onClose: () => undefined,
      onSign: () => undefined,
      title: "x",
      amount: "1",
      assetCode: "X",
      descriptionRows: [],
      signingStatus: "idle",
      isWrongNetwork: true
    };

    expect(invalid).toBeDefined();
  });

  it("requires signingErrorMessage whenever signingStatus is rejected (compile-time contract, R3-silent-rejection)", () => {
    // @ts-expect-error signingStatus: "signature-rejected" must be paired with signingErrorMessage under
    // the discriminated union — this object is intentionally invalid to prove the type rejects it.
    const invalid: TransactionReviewModalProps = {
      isOpen: true,
      onClose: () => undefined,
      onSign: () => undefined,
      title: "x",
      amount: "1",
      assetCode: "X",
      descriptionRows: [],
      signingStatus: "signature-rejected"
    };

    expect(invalid).toBeDefined();
  });
});

describe("MonoValue copy behavior (R3-copy-untested)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies the FULL value to the clipboard (not the truncated glyph) and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /copiar cuenta origen/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SOURCE_ACCOUNT));
    const confirmation = await screen.findByText("Copiado");
    expect(confirmation.closest('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("shows a visible failure message when the clipboard write rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /copiar cuenta origen/i }));

    expect(await screen.findByText(/no se pudo copiar/i)).toBeInTheDocument();
  });

  it("shows a visible failure message when the clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });

    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /copiar cuenta origen/i }));

    expect(await screen.findByText(/no se pudo copiar/i)).toBeInTheDocument();
  });
});
