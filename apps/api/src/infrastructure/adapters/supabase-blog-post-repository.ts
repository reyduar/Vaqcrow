import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  BlogPostRecord,
  BlogPostRepositoryPort,
  BlogPostRepositoryResult,
  BlogPostSummaryRecord
} from "../../application/ports/blog-post-repository-port.js";

const TABLE = "blog_post";
const SUMMARY_COLUMNS = "slug,title,summary,published_at";
const DETAIL_COLUMNS = "slug,title,summary,published_at,source_path";

/**
 * Reads `public.blog_post` as `service_role` (#498/WU2). Only rows with a
 * non-null `published_at` are read, so an unpublished post is absent from the
 * listing and resolves to `undefined` on lookup — the same absence, so the
 * route answers 404 for both. `source_path` is read only for the detail, where
 * the content source needs it; it never crosses the use-case boundary.
 *
 * Every PostgREST failure collapses to one sanitized `unavailable` code; a
 * malformed row throws and is caught the same way. The provider's
 * message/details/hint never reach the caller.
 */
export class SupabaseBlogPostRepository implements BlogPostRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async listPublished(): Promise<BlogPostRepositoryResult<readonly BlogPostSummaryRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select(SUMMARY_COLUMNS)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });

      if (error) return { ok: false, error: this.error(error) };
      if (!Array.isArray(data)) throw new Error("Malformed blog read");

      return { ok: true, value: data.map((row) => this.toSummary(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findPublished(slug: string): Promise<BlogPostRepositoryResult<BlogPostRecord | undefined>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select(DETAIL_COLUMNS)
        .eq("slug", slug)
        .not("published_at", "is", null)
        .maybeSingle();

      if (error) return { ok: false, error: this.error(error) };
      if (data === null || data === undefined) return { ok: true, value: undefined };

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toSummary(row: unknown): BlogPostSummaryRecord {
    const value = this.asRecord(row);
    return {
      slug: this.text(value["slug"]),
      title: this.text(value["title"]),
      summary: this.text(value["summary"]),
      publishedAt: this.text(value["published_at"])
    };
  }

  private toRecord(row: unknown): BlogPostRecord {
    const value = this.asRecord(row);
    return {
      slug: this.text(value["slug"]),
      title: this.text(value["title"]),
      summary: this.text(value["summary"]),
      publishedAt: this.text(value["published_at"]),
      sourcePath: this.text(value["source_path"])
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Malformed blog row");
    }
    return value as Record<string, unknown>;
  }

  private text(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) throw new Error("Malformed blog column");
    return value;
  }

  /** PostgREST failures collapse to one sanitized code; no provider text crosses this boundary. */
  private error(error: PostgrestError): { readonly code: "unavailable" } {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
    console.error("[SupabaseBlogPostRepository] persistence error", { code: error.code });
    return { code: "unavailable" };
  }
}
