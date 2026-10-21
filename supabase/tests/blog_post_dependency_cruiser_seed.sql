begin;

select plan(6);

-- Seed of the dependency-cruiser Blog article. The body lives in the
-- repository — `docs/guides/blog/dependency-cruiser-en-vaqcrow.md` — and is
-- served by the API; the seed only registers its row in `public.blog_post`. It
-- is idempotent (`on conflict (slug) do update`), so the row exists exactly
-- once, is published and points at its Markdown source.

select is(
  (select count(*)::int from public.blog_post where slug = 'dependency-cruiser-en-vaqcrow'),
  1,
  'the dependency-cruiser article is registered exactly once'
);

select ok(
  (select published_at is not null from public.blog_post where slug = 'dependency-cruiser-en-vaqcrow'),
  'the dependency-cruiser article is published'
);

select is(
  (select source_path from public.blog_post where slug = 'dependency-cruiser-en-vaqcrow'),
  'blog/dependency-cruiser-en-vaqcrow.md',
  'the dependency-cruiser article points at its Markdown source file'
);

select is(
  (select title from public.blog_post where slug = 'dependency-cruiser-en-vaqcrow'),
  'dependency-cruiser: la arquitectura de Vaqcrow, revisada en cada cambio',
  'the dependency-cruiser article carries its title'
);

select ok(
  (select summary <> '' from public.blog_post where slug = 'dependency-cruiser-en-vaqcrow'),
  'the dependency-cruiser article carries a summary'
);

-- Idempotency: re-running the seed's upsert must not duplicate the row.
set local role service_role;

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'dependency-cruiser-en-vaqcrow',
  'blog/dependency-cruiser-en-vaqcrow.md',
  'dependency-cruiser: la arquitectura de Vaqcrow, revisada en cada cambio',
  'Resumen de prueba para el renglón ya sembrado.',
  '2026-10-21T00:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;

select is(
  (select count(*)::int from public.blog_post where slug = 'dependency-cruiser-en-vaqcrow'),
  1,
  're-running the seed upserts instead of duplicating the row'
);

reset role;

select * from finish();

rollback;
