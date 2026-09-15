import { describe, expect, it } from "vitest";
import { isWorkspaceBootstrapped } from "./index.js";

describe("isWorkspaceBootstrapped", () => {
  it("returns true when at least one package name is given", () => {
    expect(isWorkspaceBootstrapped(["domain"])).toBe(true);
  });

  it("returns false when no package names are given", () => {
    expect(isWorkspaceBootstrapped([])).toBe(false);
  });
});
