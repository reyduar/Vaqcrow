import { describe, expect, it } from "vitest";
import { apiBootstrapProbe } from "./index.js";

describe("apiBootstrapProbe", () => {
  it("resolves the workspace graph across @vaqcrow/contracts and @vaqcrow/domain", () => {
    expect(apiBootstrapProbe()).toBe("api:ready");
  });
});
