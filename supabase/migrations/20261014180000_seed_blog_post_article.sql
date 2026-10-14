-- Seed of the first Blog article (Feature #498, WU4). The article body lives in
-- the repository at `docs/guides/blog/vaqcrow-sobre-stellar.md` and is served by
-- the API; this migration only registers the mapping row in `public.blog_post`
-- (owner decision D3: the body never lives in the database).
--
-- Idempotent: `on conflict (slug) do update` keeps the row's title, summary and
-- publication date in step with this file on a re-apply, without duplicating it
-- (slug is the primary key). `published_at` is set, so the API lists and serves
-- the article and the «Blog» section of «Acerca de» shows it.
--
-- `slug` is `vaqcrow-sobre-stellar`, which satisfies the table's
-- `^[a-z0-9]+(?:-[a-z0-9]+)*$` check; `source_path` is relative to
-- `docs/guides/` — exactly `blog/vaqcrow-sobre-stellar.md` — and the API is the
-- one that validates it against that root (see WU1's migration).
--
-- Migration workflow: verified against the local stack first (`pnpm run test:db`)
-- and applied to the remote Supabase project afterwards, in the same work unit,
-- once the local suite is green.
--
-- Reversal (leaving the row in place is equally safe: the seed only inserts
-- metadata that maps a slug to a source file, and nothing cascades from it):
--   delete from public.blog_post where slug = 'vaqcrow-sobre-stellar';

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'vaqcrow-sobre-stellar',
  'blog/vaqcrow-sobre-stellar.md',
  'Vaqcrow: financiar a las PyMEs argentinas con una bóveda en Stellar',
  'Cómo Vaqcrow conecta a una PyME argentina con inversores en Stellar Testnet y devuelve el capital con un porcentaje de las ventas mensuales.',
  '2026-10-14T12:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;
