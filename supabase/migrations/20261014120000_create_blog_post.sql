-- Blog in Markdown backed by `docs/guides` (Feature #498, Task T1a). This
-- migration is the database foundation only: the API adapter that serves the
-- bundled Markdown and the web pages land in later units.
--
-- `public.blog_post` maps a stable URL slug to a Markdown source file under
-- `docs/guides/` (for example `blog/vaqcrow-sobre-stellar.md`). The body itself
-- lives in the repository, never in the database: the row is only the mapping
-- plus the listing metadata (title, summary, published_at). New articles are
-- added by a migration/seed; there is no admin write path.
--
-- `published_at` is null until the article is published, so the API lists and
-- serves only rows whose `published_at` is not null.
--
-- Access: RLS is enabled with NO policy and NO grant for `anon` or
-- `authenticated`. Public blog content is served by the API as `service_role`,
-- which bypasses RLS; neither browser role reads this table directly. Grants are
-- set in the same migration so no default anon/authenticated grant ever survives
-- even transiently.
--
-- `slug` is the natural primary key: it is the URL segment and the lookup key.
-- `source_path` is relative to `docs/guides/`; the API is the one that validates
-- it against that root, so the database stores the reference verbatim.
--
-- Migration workflow: verified against the local stack first (`pnpm run test:db`)
-- and applied to the remote Supabase project afterwards, in the same work unit,
-- once the local suite is green.
--
-- Reversal (no data outside this feature depends on it):
--   drop table if exists public.blog_post;

create table public.blog_post (
  -- URL segment (`/blog/<slug>`), used verbatim as the lookup key.
  slug         text primary key
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  source_path  text not null
    check (source_path <> ''),
  title        text not null,
  summary      text not null,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Listing published posts newest-first (the `/blog` index and the «Blog»
-- section in «Acerca de»). Partial on `published_at is not null` so the index
-- only covers published rows.
create index blog_post_published_at_idx
  on public.blog_post (published_at desc)
  where published_at is not null;

-- Access control: RLS on, grants explicit in this same migration so no default
-- anon/authenticated grant ever survives even transiently.
alter table public.blog_post enable row level security;

revoke all on public.blog_post from anon, authenticated, service_role;

-- The API is the only reader and writer: it serves the Markdown and lists the
-- published posts. It connects as service_role, which bypasses RLS.
grant all on public.blog_post to service_role;
