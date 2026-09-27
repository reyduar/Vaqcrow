import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IoFileTrayOutline } from "react-icons/io5";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the visible title and body", () => {
    render(<EmptyState title="Sin resultados" body="No encontramos campañas con esos filtros." />);

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByText("No encontramos campañas con esos filtros.")).toBeInTheDocument();
  });

  it("renders no action when none is provided", () => {
    render(<EmptyState title="Sin resultados" body="Texto" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the action as the shared Button and fires onPress", () => {
    const onPress = vi.fn();
    render(
      <EmptyState
        title="Sin resultados"
        body="Texto"
        action={{ label: "Limpiar filtros", onPress }}
      />
    );

    const button = screen.getByRole("button", { name: "Limpiar filtros" });
    fireEvent.click(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("marks the optional decorative icon aria-hidden", () => {
    render(<EmptyState title="Sin resultados" body="Texto" icon={IoFileTrayOutline} />);

    const icon = document.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
