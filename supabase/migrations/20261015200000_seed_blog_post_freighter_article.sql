-- Seed of the Freighter + Friendbot Blog article (Feature #558). The article
-- body lives in the repository at
-- `docs/guides/blog/freighter-y-friendbot-paso-a-paso.md` and is served by the
-- API; this migration only registers the mapping row in `public.blog_post`
-- (owner decision D3 of #498: the body never lives in the database).
--
-- Idempotent: `on conflict (slug) do update` keeps the row's title, summary and
-- publication date in step with this file on a re-apply, without duplicating it
-- (slug is the primary key). `published_at` is set, so the API lists and serves
-- the article on `/blog`.
--
-- `slug` satisfies the table's `^[a-z0-9]+(?:-[a-z0-9]+)*$` check;
-- `source_path` is relative to `docs/guides/`, and the API validates it against
-- that root.
--
-- Order: the API serves the body from the Markdown bundled in its image, so the
-- row must reach the remote project only once the API is deployed with this
-- article; otherwise `/blog` lists a post that cannot be opened yet.
--
-- Reversal (leaving the row in place is equally safe: the seed only inserts
-- metadata that maps a slug to a source file, and nothing cascades from it):
--   delete from public.blog_post where slug = 'freighter-y-friendbot-paso-a-paso';

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'freighter-y-friendbot-paso-a-paso',
  'blog/freighter-y-friendbot-paso-a-paso.md',
  'Freighter y Friendbot, paso a paso: tu wallet de Testnet en Chrome',
  'Cómo agregar Freighter a Chrome, crear tu cuenta, pasarla a Testnet y cargarle XLM de prueba con Friendbot para usar Vaqcrow.',
  '2026-10-15T12:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;
