import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanyTestnetFunds, friendbotUrl } from "./company-testnet-funds";

const PUBLIC_KEY = "GBXK1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ2345677Q2M";

describe("friendbotUrl", () => {
  it("returns the generic Friendbot URL when no public key is known", () => {
    expect(friendbotUrl(null)).toBe("https://friendbot.stellar.org");
    expect(friendbotUrl()).toBe("https://friendbot.stellar.org");
  });

  it("prefills the public key as the addr query when one is known", () => {
    expect(friendbotUrl(PUBLIC_KEY)).toBe(`https://friendbot.stellar.org/?addr=${PUBLIC_KEY}`);
  });
});

describe("CompanyTestnetFunds", () => {
  it("renders the guide text and the non-custodial note", () => {
    render(<CompanyTestnetFunds publicKey={null} />);

    expect(screen.getByRole("heading", { name: "Fondear tu wallet con XLM de prueba" })).toBeInTheDocument();
    expect(screen.getByText(/Vaqcrow no custodia fondos ni mueve dinero/i)).toBeInTheDocument();
    expect(screen.getByText(/Sólo XLM de Testnet, sin valor económico/i)).toBeInTheDocument();
  });

  it("links to the generic Friendbot when no public key is known", () => {
    render(<CompanyTestnetFunds publicKey={null} />);

    expect(screen.getByRole("link", { name: /Friendbot/i })).toHaveAttribute(
      "href",
      "https://friendbot.stellar.org"
    );
  });

  it("prefills the connected public key in the Friendbot link", () => {
    render(<CompanyTestnetFunds publicKey={PUBLIC_KEY} />);

    const link = screen.getByRole("link", { name: /Friendbot/i });
    expect(link).toHaveAttribute("href", `https://friendbot.stellar.org/?addr=${PUBLIC_KEY}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
