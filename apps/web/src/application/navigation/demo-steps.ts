export type DemoStepSlug =
  | "request"
  | "ai-assessment"
  | "approval"
  | "funding"
  | "distribution"
  | "evidence";

export interface DemoStep {
  readonly slug: DemoStepSlug;
  readonly label: string;
}

export const demoSteps: readonly DemoStep[] = Object.freeze([
  Object.freeze({ slug: "request", label: "Request" }),
  Object.freeze({ slug: "ai-assessment", label: "AI Assessment" }),
  Object.freeze({ slug: "approval", label: "Approval" }),
  Object.freeze({ slug: "funding", label: "Funding" }),
  Object.freeze({ slug: "distribution", label: "Distribution" }),
  Object.freeze({ slug: "evidence", label: "Evidence" })
] as const);

export const demoStepCount = 6;

const demoStepSlugs: readonly string[] = demoSteps.map((step) => step.slug);

export function isDemoStepSlug(value: string): value is DemoStepSlug {
  return demoStepSlugs.includes(value);
}

export function demoStepPosition(slug: DemoStepSlug): number {
  return demoSteps.findIndex((step) => step.slug === slug) + 1;
}

export interface DemoStepAdjacency {
  readonly previous: DemoStep | null;
  readonly next: DemoStep | null;
}

export function demoStepAdjacency(slug: DemoStepSlug): DemoStepAdjacency {
  const index = demoSteps.findIndex((step) => step.slug === slug);
  return {
    previous: demoSteps[index - 1] ?? null,
    next: demoSteps[index + 1] ?? null
  };
}

export function demoStepHref(slug: DemoStepSlug): string {
  return `/${slug}`;
}
