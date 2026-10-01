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
  Object.freeze({ slug: "request", label: "Solicitud" }),
  Object.freeze({ slug: "ai-assessment", label: "Evaluación de IA" }),
  Object.freeze({ slug: "approval", label: "Aprobación" }),
  Object.freeze({ slug: "funding", label: "Fondeo" }),
  Object.freeze({ slug: "distribution", label: "Distribución" }),
  Object.freeze({ slug: "evidence", label: "Evidencia" })
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
