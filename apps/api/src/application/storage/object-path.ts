/**
 * Server-owned object-path ownership check (content-relevance/vision feature U2).
 *
 * The storage adapter is constructed with the shared `service_role` client,
 * which bypasses RLS, so the API — not Supabase — owns path authorization. This
 * is the single source of that discipline, mirroring the DELETE
 * `/storage/uploads` route: a path is owned only when it sits under the caller's
 * own `userId/` prefix AND every segment after the prefix is a real,
 * non-traversal segment. A bare string prefix is not enough — `..`, `.` and
 * empty segments would let a prefix-matching path resolve elsewhere in the
 * bucket, so those are refused.
 *
 * Pure and vendor-free: no Fastify, no Supabase, no principal type. Callers pass
 * the verified `userId`; the content-relevance download resolves the path from
 * the owner's `pyme_document` row and re-checks it here before reading bytes.
 */
export function isOwnedObjectPath(path: string, userId: string): boolean {
  const prefix = `${userId}/`;
  if (!path.startsWith(prefix) || path.length <= prefix.length) {
    return false;
  }

  const remainder = path.slice(prefix.length);
  return !remainder.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}
