import { describe, expect, it } from "vitest";
import { isOwnedObjectPath } from "./object-path.js";

const USER = "00000000-0000-4000-8000-000000000004";

describe("isOwnedObjectPath", () => {
  it("accepts a path under the owner's own userId/ prefix", () => {
    expect(isOwnedObjectPath(`${USER}/cuit/abc-cuit.pdf`, USER)).toBe(true);
    expect(isOwnedObjectPath(`${USER}/photo/abc-1.jpg`, USER)).toBe(true);
  });

  it("rejects a path that belongs to a different user", () => {
    expect(isOwnedObjectPath(`11111111-1111-4111-8111-111111111111/cuit/a.pdf`, USER)).toBe(false);
  });

  it("rejects a path that is exactly the prefix (no object segment)", () => {
    expect(isOwnedObjectPath(`${USER}/`, USER)).toBe(false);
    expect(isOwnedObjectPath(USER, USER)).toBe(false);
  });

  it("rejects traversal and empty segments inside the owned prefix", () => {
    expect(isOwnedObjectPath(`${USER}/../other/a.pdf`, USER)).toBe(false);
    expect(isOwnedObjectPath(`${USER}/./a.pdf`, USER)).toBe(false);
    expect(isOwnedObjectPath(`${USER}//a.pdf`, USER)).toBe(false);
    expect(isOwnedObjectPath(`${USER}/cuit/../../a.pdf`, USER)).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isOwnedObjectPath("", USER)).toBe(false);
  });
});
