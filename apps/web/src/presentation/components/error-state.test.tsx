import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  it("renders role=alert with the visible title and message", () => {
    render(
      <ErrorState
        title="No pudimos cargar las campañas"
        message="Revisá tu conexión e intentá de nuevo."
        onRetry={() => {}}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("No pudimos cargar las campañas")).toBeInTheDocument();
    expect(screen.getByText("Revisá tu conexión e intentá de nuevo.")).toBeInTheDocument();
  });

  it("renders the retry action as the shared Button and fires onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Error" message="Algo salió mal." onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: "Reintentar" });
    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("accepts a custom retry label", () => {
    render(
      <ErrorState title="Error" message="Algo salió mal." onRetry={() => {}} retryLabel="Volver a intentar" />
    );

    expect(screen.getByRole("button", { name: "Volver a intentar" })).toBeInTheDocument();
  });

  it("renders only the title when no message is provided", () => {
    render(<ErrorState title="Something went wrong loading this step." onRetry={() => {}} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong loading this step.")).toBeInTheDocument();
    expect(screen.queryByText("Algo salió mal.")).not.toBeInTheDocument();
    expect(document.querySelector("p.text-sm")).not.toBeInTheDocument();
  });
});
