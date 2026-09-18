import { parseApplicationId } from "@vaqcrow/contracts";
import type { ApplicationId } from "@vaqcrow/contracts";

const SYNTHETIC_PREFIX = "deadbeef";

/** Lower bound (inclusive) of the reserved synthetic `application_id` range. */
export const SYNTHETIC_LO = `${SYNTHETIC_PREFIX}-0000-4000-8000-000000000000`;

/** Upper bound (inclusive) of the reserved synthetic `application_id` range. */
export const SYNTHETIC_HI = `${SYNTHETIC_PREFIX}-0000-4000-8000-ffffffffffff`;

const registeredSyntheticIds = new Set<ApplicationId>();

function randomUuidTail(): string {
  const crypto = Reflect.get(globalThis, "crypto") as { randomUUID(): string };
  return crypto.randomUUID().slice(-12);
}

/**
 * Mints a valid UUIDv4 `ApplicationId` inside the reserved synthetic range
 * and registers it for cleanup. Every id minted here MUST be deleted by the
 * suite's cleanup hooks before the process exits.
 */
export function syntheticApplicationId(): ApplicationId {
  const id = parseApplicationId(`${SYNTHETIC_PREFIX}-0000-4000-8000-${randomUuidTail()}`);
  registeredSyntheticIds.add(id);
  return id;
}

/** Snapshot of every synthetic id minted and not yet cleared. */
export function registeredSyntheticApplicationIds(): readonly ApplicationId[] {
  return Array.from(registeredSyntheticIds);
}

/** Clears the registry. Call after cleanup has deleted the corresponding rows. */
export function clearRegisteredSyntheticApplicationIds(): void {
  registeredSyntheticIds.clear();
}
