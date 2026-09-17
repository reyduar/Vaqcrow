import { describe, expect, it } from "vitest";
import {
  demoStepAdjacency,
  demoStepCount,
  demoStepHref,
  demoStepPosition,
  demoSteps,
  isDemoStepSlug
} from "./demo-steps";

describe("demoSteps", () => {
  it("orders the six demo steps request through evidence", () => {
    expect(demoSteps.map((step) => step.slug)).toEqual([
      "request",
      "ai-assessment",
      "approval",
      "funding",
      "distribution",
      "evidence"
    ]);
  });

  it("is frozen so consumers cannot mutate the sequence", () => {
    expect(Object.isFrozen(demoSteps)).toBe(true);
  });
});

describe("demoStepCount", () => {
  it("equals six", () => {
    expect(demoStepCount).toBe(6);
  });
});

describe("isDemoStepSlug", () => {
  it("accepts a known slug", () => {
    expect(isDemoStepSlug("funding")).toBe(true);
  });

  it("rejects an unknown slug", () => {
    expect(isDemoStepSlug("not-a-step")).toBe(false);
  });
});

describe("demoStepPosition", () => {
  it("returns 1 for the first step", () => {
    expect(demoStepPosition("request")).toBe(1);
  });

  it("returns 6 for the last step", () => {
    expect(demoStepPosition("evidence")).toBe(6);
  });

  it("returns the 1-based position for a middle step", () => {
    expect(demoStepPosition("funding")).toBe(4);
  });
});

describe("demoStepAdjacency", () => {
  it("has no previous step on request, the first step", () => {
    expect(demoStepAdjacency("request").previous).toBeNull();
    expect(demoStepAdjacency("request").next?.slug).toBe("ai-assessment");
  });

  it("has no next step on evidence, the last step", () => {
    expect(demoStepAdjacency("evidence").next).toBeNull();
    expect(demoStepAdjacency("evidence").previous?.slug).toBe("distribution");
  });

  it("resolves both neighbors for a middle step", () => {
    const adjacency = demoStepAdjacency("approval");

    expect(adjacency.previous?.slug).toBe("ai-assessment");
    expect(adjacency.next?.slug).toBe("funding");
  });
});

describe("demoStepHref", () => {
  it("builds an absolute path from the slug", () => {
    expect(demoStepHref("ai-assessment")).toBe("/ai-assessment");
  });

  it("builds a different path for a different slug", () => {
    expect(demoStepHref("distribution")).toBe("/distribution");
  });
});
