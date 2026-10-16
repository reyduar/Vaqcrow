-- Seed of the revenue-share explanation Blog article (#579). The article body
-- lives in the repository at `docs/guides/blog/revenue-share-explicado.md` and
-- is served by the API; this migration only registers the mapping row in
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
--   delete from public.blog_post where slug = 'revenue-share-explicado';

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'revenue-share-explicado',
  'blog/revenue-share-explicado.md',
  'El revenue share de Vaqcrow, explicado en simple',
  'Qué es el revenue share, cómo se reparte en proporción a lo que aportó cada inversor y por qué la transacción la firma la PyME en Freighter, en palabras simples.',
  '2026-10-16T12:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;
