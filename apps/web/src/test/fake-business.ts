/**
 * Test-only in-memory `BusinessPort`. No network, no Supabase.
 *
 * It mirrors the adapter's observable contract: the owner is resolved by the
 * backend (a fixed synthetic id) and a company is `not_found` until one is
 * created. It adds controls the real adapter does not have — seeded existing
 * company, per-operation failures — so the wizard's reuse and failure paths are
 * exercised without fake timers.
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import type {
  BusinessDraft,
  BusinessErrorCode,
  BusinessPort,
  BusinessRecord,
  BusinessResult
} from "@/application/ports/business-port";

/** A stable synthetic row the API would return for the signed-in owner. */
export function fakeBusinessRecord(draft: BusinessDraft): BusinessRecord {
  return {
    businessId: "b1e6c2a4-9f3d-4a7b-8c1e-5d2f6a9b0c31",
    ownerUserId: "00000000-0000-4000-8000-000000000000",
    ...draft,
    createdAt: "2026-10-03T12:00:00.000Z",
    updatedAt: "2026-10-03T12:00:00.000Z"
  };
}

type Operation = "create" | "get";

export class FakeBusiness implements BusinessPort {
  /** Drafts passed to `createBusiness`, in order. */
  readonly creates: BusinessDraft[] = [];
  /** Calls of `getMyBusiness` received. */
  getCalls = 0;

  private existing: BusinessRecord | null;
  private readonly failures = new Map<Operation, BusinessErrorCode>();

  constructor(existing: BusinessRecord | null = null) {
    this.existing = existing;
  }

  /** Makes `getMyBusiness` answer an owned company. */
  seedExisting(record: BusinessRecord): void {
    this.existing = record;
  }

  /** The next call of `operation` answers `{ ok: false, code }`. */
  failNext(operation: Operation, code: BusinessErrorCode = "unavailable"): void {
    this.failures.set(operation, code);
  }

  async getMyBusiness(): Promise<BusinessResult> {
    this.getCalls += 1;
    const failure = this.failures.get("get");
    if (failure) {
      this.failures.delete("get");
      return { ok: false, code: failure };
    }
    if (!this.existing) return { ok: false, code: "not_found" };
    return { ok: true, business: this.existing };
  }

  async createBusiness(draft: BusinessDraft): Promise<BusinessResult> {
    this.creates.push(draft);
    const failure = this.failures.get("create");
    if (failure) {
      this.failures.delete("create");
      return { ok: false, code: failure };
    }
    const business = fakeBusinessRecord(draft);
    this.existing = business;
    return { ok: true, business };
  }
}
