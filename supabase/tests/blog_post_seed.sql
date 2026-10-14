begin;

select plan(7);

-- Seed of the first Blog article (Feature #498, WU4). The article body lives in
-- the repository — `docs/guides/blog/vaqcrow-sobre-stellar.md` — and is served by
-- the API; this seed only registers the row in `public.blog_post` so the API can
-- list and serve it. The seed is idempotent (`on conflict (slug) do update`), so
-- the row exists exactly once, is published, and points at a source path under
-- `docs/guides/blog/` that satisfies the table's slug shape.

select is(
  (select count(*)::int from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  1,
  'the seeded article is registered exactly once'
);

select ok(
  (select published_at is not null from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  'the seeded article is published'
);

select is(
  (select source_path from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  'blog/vaqcrow-sobre-stellar.md',
  'the seeded article points at its Markdown source file'
);

select is(
  (select title from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  'Vaqcrow: financiar a las PyMEs argentinas con una bóveda en Stellar',
  'the seeded article carries its title'
);

select ok(
  (select summary <> '' from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  'the seeded article carries a summary'
);

select matches(
  (select source_path from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  '^blog/[a-z0-9]+(?:-[a-z0-9]+)*\.md$',
  'the source path is a blog slug under docs/guides/blog/'
);

-- Idempotency: re-running the seed's upsert must not duplicate the row.
set local role service_role;

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'vaqcrow-sobre-stellar',
  'blog/vaqcrow-sobre-stellar.md',
  'Vaqcrow: financiar a las PyMEs argentinas con una bóveda en Stellar',
  'Resumen de prueba para el renglón ya sembrado.',
  '2026-10-15T00:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;

select is(
  (select count(*)::int from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  1,
  're-running the seed upserts instead of duplicating the row'
);

reset role;

select * from finish();

rollback;
