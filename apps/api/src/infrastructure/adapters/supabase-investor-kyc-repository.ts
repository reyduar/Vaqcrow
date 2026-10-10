import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  InvestorKycApproveResult,
  InvestorKycReadResult,
  InvestorKycRepositoryPort,
  StoredInvestorKyc
} from "../../application/ports/investor-kyc-repository-port.js";

/**
 * Supabase adapter for the investor's simulated KYC (#422/WU4).
 *
 * The API connects as `service_role`, so every read/write here bypasses RLS and
 * is the single enforcement point; the caller's `userId` comes from the verified
 * principal and always scopes the query. `approve` is idempotent on the primary
 * key: `23505` (unique violation) means the record already exists, so the
 * existing row is re-read and returned with `created: false` — never a duplicate
 * and never an error. Every other error is logged with its
 * `code`/`message`/`details`/`hint` for operators and returned as a sanitized
 * `unavailable`; provider text never crosses this boundary.
 */

const KYC_TABLE = "investor_kyc";
const UNIQUE_VIOLATION = "23505";

interface InvestorKycColumns {
  readonly approved_at?: unknown;
  readonly simulado?: unknown;
}

export class SupabaseInvestorKycRepository implements InvestorKycRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async find(userId: string): Promise<InvestorKycReadResult> {
    try {
      const { data, error } = await this.client
        .from(KYC_TABLE)
        .select("approved_at, simulado")
        .eq("user_id", userId);

      if (error) {
        this.logProviderError("find", error);
        return { ok: false, error: { code: "unavailable" } };
      }

      const rows = Array.isArray(data) ? (data as InvestorKycColumns[]) : [];
      if (rows.length === 0) {
        // A genuine absence: the investor has not contributed yet.
        return { ok: true, value: null };
      }

      const record = this.toRecord(rows[0]!, "find");
      if (record === null) {
        return { ok: false, error: { code: "unavailable" } };
      }
      return { ok: true, value: record };
    } catch (cause) {
      this.logUnexpected("find", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async approve(userId: string): Promise<InvestorKycApproveResult> {
    try {
      const { data, error } = await this.client
        .from(KYC_TABLE)
        .insert({ user_id: userId })
        .select("approved_at, simulado");

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          return this.readExisting(userId);
        }
        this.logProviderError("approve", error);
        return { ok: false, error: { code: "unavailable" } };
      }

      const rows = Array.isArray(data) ? (data as InvestorKycColumns[]) : [];
      const record = rows.length === 1 ? this.toRecord(rows[0]!, "approve") : null;
      if (record === null) {
        return { ok: false, error: { code: "unavailable" } };
      }
      return { ok: true, value: { ...record, created: true } };
    } catch (cause) {
      this.logUnexpected("approve", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * The idempotent replay: the record already exists. It re-reads through
   * `find` so a genuine read failure is still `unavailable`, and the missing
   * case (a conflict with no readable row) is a sanitized failure, never an
   * invented approval.
   */
  private async readExisting(userId: string): Promise<InvestorKycApproveResult> {
    const existing = await this.find(userId);
    if (!existing.ok) {
      return { ok: false, error: { code: "unavailable" } };
    }
    if (existing.value === null) {
      this.logUnexpected("approve", new Error("unique conflict without a readable record"));
      return { ok: false, error: { code: "unavailable" } };
    }
    return { ok: true, value: { ...existing.value, created: false } };
  }

  /** Validates one row's shape; a malformed row is a sanitized failure. */
  private toRecord(row: InvestorKycColumns, operation: string): StoredInvestorKyc | null {
    const { approved_at: approvedAt, simulado } = row;
    if (typeof approvedAt !== "string" || typeof simulado !== "boolean") {
      this.logUnexpected(operation, new Error("malformed investor_kyc row"));
      return null;
    }
    return { approvedAt, simulado };
  }

  private logProviderError(operation: string, error: PostgrestError): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseInvestorKycRepository] ${operation} error`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
  }

  private logUnexpected(operation: string, cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseInvestorKycRepository] ${operation} threw`, {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}
