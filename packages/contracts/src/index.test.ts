import { describe, expect, it } from "vitest";
import { describeWorkspace } from "./index.js";

describe("describeWorkspace", () => {
  it("returns a probe carrying the given name", () => {
    expect(describeWorkspace("contracts")).toEqual({ name: "contracts" });
  });
});
