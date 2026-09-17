import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

describe("Loading (demo route group)", () => {
  it("renders the shared demo step loading UI", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading step…")).toBeInTheDocument();
  });
});
