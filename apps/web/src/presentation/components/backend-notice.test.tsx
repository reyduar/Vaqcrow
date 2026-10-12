import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BACKEND_NOTICE_COPY, BackendNotice } from "./backend-notice";

describe("BackendNotice", () => {
  // Issue #480: the "no backend configured" state is informational, not a
  // failure — it must not be an alert and must not offer a dead-end retry.
  it("renders role=status (not alert) with the notice copy", () => {
    render(<BackendNotice />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText(BACKEND_NOTICE_COPY.title)).toBeInTheDocument();
    expect(screen.getByText(BACKEND_NOTICE_COPY.body)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers no retry action", () => {
    render(<BackendNotice />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
