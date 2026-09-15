import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceStatus } from "./workspace-status";

describe("WorkspaceStatus", () => {
  it("renders the workspace heading", () => {
    render(<WorkspaceStatus />);

    expect(screen.getByRole("heading", { name: "Vaqcrow Workspace" })).toBeInTheDocument();
  });

  it("renders the not-connected status message", () => {
    render(<WorkspaceStatus />);

    expect(screen.getByText("Status: not connected")).toBeInTheDocument();
  });

  it("shows connection failed after clicking connect, since the wallet adapter is a stub", async () => {
    render(<WorkspaceStatus />);

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    await waitFor(() => {
      expect(screen.getByText("Status: connection failed")).toBeInTheDocument();
    });
  });
});
