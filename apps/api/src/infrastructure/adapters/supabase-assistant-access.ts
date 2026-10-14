import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AssistantAccessPort, AssistantAccessResult } from "../../application/ports/assistant-access-port.js";

/**
 * The Supabase assistant-access adapter (#499/WU2).
 *
 * The API connects as `service_role`, so every read/write here bypasses RLS and
 * is the single enforcement point for the access flag and the rolling-window
 * usage. `profile.chat_enabled` is the flag (off by default); a missing profile
 * resolves to `false` (fail closed). `assistant_question` stores only the
 * timestamp, never the question text (owner decision D5). A provider error, a
 * malformed row or a throw is a sanitized `unavailable` — `message`/`details`/
 * `hint` never cross this boundary.
 */

const PROFILE_TABLE = "profile";
const QUESTION_TABLE = "assistant_question";
const KEY_COLUMN = "user_id";
const ASKED_AT_COLUMN = "asked_at";
const FLAG_COLUMN = "chat_enabled";

const UNAVAILABLE: AssistantAccessResult<never> = { ok: false, error: { code: "unavailable" } };

export class SupabaseAssistantAccess implements AssistantAccessPort {
  constructor(private readonly client: SupabaseClient) {}

  async isChatEnabled(userId: string): Promise<AssistantAccessResult<boolean>> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .select(FLAG_COLUMN)
        .eq(KEY_COLUMN, userId)
        .maybeSingle();

      if (error) {
        this.logProvider("isChatEnabled", error);
        return UNAVAILABLE;
      }
      // No profile means no access: fail closed.
      if (data === null || data === undefined) return { ok: true, value: false };

      const flag = (data as { readonly chat_enabled?: unknown }).chat_enabled;
      if (typeof flag !== "boolean") {
        this.logUnexpected("isChatEnabled", new Error("malformed chat_enabled"));
        return UNAVAILABLE;
      }

      return { ok: true, value: flag };
    } catch (cause) {
      this.logUnexpected("isChatEnabled", cause);
      return UNAVAILABLE;
    }
  }

  async countRecentQuestions(userId: string, since: Date): Promise<AssistantAccessResult<number>> {
    try {
      const { count, error } = await this.client
        .from(QUESTION_TABLE)
        .select(ASKED_AT_COLUMN, { count: "exact", head: true })
        .eq(KEY_COLUMN, userId)
        .gte(ASKED_AT_COLUMN, since.toISOString());

      if (error) {
        this.logProvider("countRecentQuestions", error);
        return UNAVAILABLE;
      }
      // Without an exact count the cap cannot be applied honestly.
      if (count === null || count === undefined) {
        this.logUnexpected("countRecentQuestions", new Error("count without an exact value"));
        return UNAVAILABLE;
      }

      return { ok: true, value: count };
    } catch (cause) {
      this.logUnexpected("countRecentQuestions", cause);
      return UNAVAILABLE;
    }
  }

  async recordQuestion(userId: string, askedAt: Date): Promise<AssistantAccessResult<void>> {
    try {
      const { error } = await this.client
        .from(QUESTION_TABLE)
        .insert({ [KEY_COLUMN]: userId, [ASKED_AT_COLUMN]: askedAt.toISOString() });

      if (error) {
        this.logProvider("recordQuestion", error);
        return UNAVAILABLE;
      }

      return { ok: true, value: undefined };
    } catch (cause) {
      this.logUnexpected("recordQuestion", cause);
      return UNAVAILABLE;
    }
  }

  private logProvider(operation: string, error: PostgrestError): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseAssistantAccess] ${operation} error`, { code: error.code });
  }

  private logUnexpected(operation: string, cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseAssistantAccess] ${operation} failed`, {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}
