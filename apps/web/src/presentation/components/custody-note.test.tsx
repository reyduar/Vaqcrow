import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures } from "@/application/trust/disclosures";
import { CustodyNote } from "./custody-note";

describe("CustodyNote", () => {
  it("renders the canonical contract-custody disclosure verbatim", () => {
    render(<CustodyNote />);

    expect(screen.getByText(disclosures["contract-custody"].text)).toBeInTheDocument();
  });

  it("does not render the non-custody disclosure by default", () => {
    render(<CustodyNote />);

    expect(screen.queryByText(disclosures["non-custody"].text)).not.toBeInTheDocument();
  });

  it("also renders the canonical non-custody disclosure when a signer is in context", () => {
    render(<CustodyNote includeSigner />);

    expect(screen.getByText(disclosures["contract-custody"].text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["non-custody"].text)).toBeInTheDocument();
  });
});
