import { Skeleton } from "./skeleton";

/**
 * Demo route-group loading fallback (`app/(demo)/loading.tsx`). Adopted
 * (Issue #310 / T3) onto the shared `Skeleton` primitive instead of plain
 * text: same visible announcement ("Loading step…"), same single
 * `role="status"` region — `Skeleton` already carries the implicit
 * `aria-live="polite"` that `role="status"` grants, so no explicit attribute
 * is needed.
 */
export function DemoStepLoading() {
  return <Skeleton label="Loading step…" />;
}
