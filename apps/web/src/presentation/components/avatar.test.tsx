import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("shows initials computed from a multi-word full name when there is no image", () => {
    render(<Avatar name="Panadería Horizonte SRL" />);

    expect(screen.getByText("PH")).toBeInTheDocument();
  });

  it("computes initials from a single-word name using its first two letters", () => {
    render(<Avatar name="Vaqcrow" />);

    expect(screen.getByText("VA")).toBeInTheDocument();
  });

  it("exposes the full name as the accessible name when not decorative", () => {
    render(<Avatar name="Lucía Fernández" />);

    expect(screen.getByRole("img", { name: "Lucía Fernández" })).toBeInTheDocument();
  });

  it("is decorative and carries no accessible name when the name is already rendered as visible text next to it", () => {
    render(<Avatar name="Lucía Fernández" isDecorative />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
