import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustBanner } from "./trust-banner";

const LONG_BODY =
  "Demostración con datos simulados. La identidad, el KYC/KYB, las ventas y la conversión ARS/activo Stellar de este caso son sintéticos. No representan verificaciones ni movimientos de dinero real.";

describe("TrustBanner", () => {
  it("renders role='alert' for the error variant", () => {
    render(<TrustBanner variant="error" title="Error" body="Algo salió mal." />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders role='note' for the simulation, testnet, and fallback variants", () => {
    const { unmount: unmountSimulation } = render(
      <TrustBanner variant="simulation" title="Simulación" body="Texto" />
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
    unmountSimulation();

    const { unmount: unmountTestnet } = render(<TrustBanner variant="testnet" title="Testnet" body="Texto" />);
    expect(screen.getByRole("note")).toBeInTheDocument();
    unmountTestnet();

    render(<TrustBanner variant="fallback" title="Respaldo" body="Texto" />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("renders the full body text untruncated", () => {
    render(<TrustBanner variant="simulation" title="Demostración con datos simulados" body={LONG_BODY} />);

    expect(screen.getByText(LONG_BODY)).toBeInTheDocument();
  });

  it("renders an optional badge and link when provided", () => {
    render(
      <TrustBanner
        variant="fallback"
        title="Respuesta de respaldo"
        body="Respuesta de respaldo previamente generada; no corresponde a una llamada en vivo"
        badge={{ variant: "fallback", label: "RESPUESTA DE RESPALDO" }}
        link={{ href: "/evidence", label: "Ver evidencia" }}
      />
    );

    expect(screen.getByText("RESPUESTA DE RESPALDO")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver evidencia" })).toHaveAttribute("href", "/evidence");
  });
});
