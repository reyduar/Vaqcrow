-- Seed of the dependency-cruiser Blog article. The article body lives in the
-- repository at `docs/guides/blog/dependency-cruiser-en-vaqcrow.md` and is
-- served by the API; this migration only registers the mapping row in
-- `public.blog_post` (owner decision D3 of #498: the body never lives in the
-- database).
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
-- article; otherwise `/blog` lists a post that cannot be opened yet. Applying
-- this seed to the remote project is therefore a later operator step, not part
-- of this task.
--
-- Reversal (leaving the row in place is equally safe: the seed only inserts
-- metadata that maps a slug to a source file, and nothing cascades from it):
--   delete from public.blog_post where slug = 'dependency-cruiser-en-vaqcrow';

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'dependency-cruiser-en-vaqcrow',
  'blog/dependency-cruiser-en-vaqcrow.md',
  'dependency-cruiser: la arquitectura de Vaqcrow, revisada en cada cambio',
  'Qué es dependency-cruiser, por qué no es parte de pnpm, cómo funciona por dentro y cómo sus trece reglas mantienen las capas del monorepo de Vaqcrow en cada cambio.',
  '2026-10-21T12:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;
