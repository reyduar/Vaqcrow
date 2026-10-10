import { describe, expect, it } from "vitest";
import {
  DEPLOYMENT_STALE_AFTER_MS,
  deploymentStaleCutoff,
  isDeploymentRetryable,
  isDeploymentStale
} from "./deployment-staleness.js";

const NOW = new Date("2026-10-06T12:30:00.000Z");

describe("deployment staleness (U8)", () => {
  it("defaults the threshold to ten minutes", () => {
    expect(DEPLOYMENT_STALE_AFTER_MS).toBe(10 * 60 * 1000);
    expect(deploymentStaleCutoff(NOW).toISOString()).toBe("2026-10-06T12:20:00.000Z");
  });

  it("treats only a deploying row last updated before the cutoff as stale", () => {
    expect(isDeploymentStale({ state: "deploying", updatedAt: "2026-10-06T12:19:59.999Z" }, NOW)).toBe(true);
    // Exactly at the cutoff is not yet stale: the comparison is strict.
    expect(isDeploymentStale({ state: "deploying", updatedAt: "2026-10-06T12:20:00.000Z" }, NOW)).toBe(false);
    expect(isDeploymentStale({ state: "deploying", updatedAt: "2026-10-06T12:29:00.000Z" }, NOW)).toBe(false);
    expect(isDeploymentStale({ state: "pending", updatedAt: "2026-10-06T11:00:00.000Z" }, NOW)).toBe(false);
  });

  it("never treats an unparseable timestamp as stale", () => {
    expect(isDeploymentStale({ state: "deploying", updatedAt: "not-a-date" }, NOW)).toBe(false);
  });

  it.each([
    ["failed", "2026-10-06T12:29:00.000Z", true],
    ["deploying", "2026-10-06T12:00:00.000Z", true],
    ["deploying", "2026-10-06T12:29:00.000Z", false],
    ["pending", "2026-10-06T12:00:00.000Z", false],
    ["confirmed", "2026-10-06T12:00:00.000Z", false]
  ] as const)("reports %s updated at %s as retryable=%s", (state, updatedAt, retryable) => {
    expect(isDeploymentRetryable({ state, updatedAt }, NOW)).toBe(retryable);
  });
});
