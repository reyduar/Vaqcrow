<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Async tests: a synchronous query asserts only what the same render produced

`getBy*` / `queryBy*` / `getAllBy*` / `queryAllBy*` do not wait — they throw the instant the node is absent. A test that awaits one thing and then queries something else synchronously is a race that only surfaces under CI's timing (issue #589).

- The first assertion on asynchronously populated content awaits: `await screen.findBy…`, `await within(region).findBy…`, or `waitFor`.
- A synchronous query is legitimate only for content the same render produced. After a `fireEvent` on already-rendered markup it is fine: React flushes that event's update before the handler returns.
- Awaiting a static heading proves nothing about a region's data. When a region has independent reads — for example `CompanySubmittedData`'s business / request / documents blocks — each block needs its own awaited anchor before its synchronous siblings. Awaiting the company block does not make the documents block present.
- Do not paper over the race with a longer per-test timeout: the failure is immediate, not a timeout. Fix the query.

Re-run the audit from `apps/web`:

```bash
# every synchronous query that follows an await in the same test block
rg -n -U --glob '*.test.ts' --glob '*.test.tsx' \
  'await [^\n]*\n(?:[^\n]*\n){0,25}?[^\n]*(screen|within\([^)]*\))\.(getBy|queryBy|getAllBy|queryAllBy)' src
```

Classify each hit: if the preceding await does not assert the node the synchronous query reads (or trigger the same region's render), convert the first lookup on that region to `findBy*`. A synchronous query that precedes every await is an initial render and is out of scope.

