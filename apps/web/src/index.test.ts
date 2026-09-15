import { describe, expect, it } from "vitest";
import { webBootstrapProbe } from "./index.js";

describe("webBootstrapProbe", () => {
  it("resolves the workspace graph across @vaqcrow/contracts only", () => {
    expect(webBootstrapProbe()).toBe("web:ready");
  });
});
