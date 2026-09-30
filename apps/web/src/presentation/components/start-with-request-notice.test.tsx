import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StartWithRequestNotice } from "./start-with-request-notice";

describe("StartWithRequestNotice", () => {
  it("says the step needs the request first and links to the request step", () => {
    render(<StartWithRequestNotice />);

    expect(screen.getByRole("status")).toHaveTextContent(/primero hay que enviar la solicitud/i);
    expect(screen.getByRole("link", { name: "Ir a la solicitud" })).toHaveAttribute("href", "/request");
  });

  it("names what the step cannot do without it", () => {
    render(<StartWithRequestNotice action="abrir la campaña" />);

    expect(screen.getByRole("status")).toHaveTextContent("para poder abrir la campaña");
  });
});
