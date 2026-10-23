begin;

select plan(6);

-- Seed of the React Essentials Blog article. The body lives in the repository —
-- `docs/guides/blog/react-essentials.md` — and is served by the API; the seed
-- only registers its row in `public.blog_post`. It is idempotent
-- (`on conflict (slug) do update`), so the row exists exactly once, is
-- published and points at its Markdown source.

select is(
  (select count(*)::int from public.blog_post where slug = 'react-essentials'),
  1,
  'the React Essentials article is registered exactly once'
);

select ok(
  (select published_at is not null from public.blog_post where slug = 'react-essentials'),
  'the React Essentials article is published'
);

select is(
  (select source_path from public.blog_post where slug = 'react-essentials'),
  'blog/react-essentials.md',
  'the React Essentials article points at its Markdown source file'
);

select is(
  (select title from public.blog_post where slug = 'react-essentials'),
  'React Essentials: fundamentos, hooks y ecosistema',
  'the React Essentials article carries its title'
);

select ok(
  (select summary <> '' from public.blog_post where slug = 'react-essentials'),
  'the React Essentials article carries a summary'
);

-- Idempotency: re-running the seed's upsert must not duplicate the row.
set local role service_role;

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'react-essentials',
  'blog/react-essentials.md',
  'React Essentials: fundamentos, hooks y ecosistema',
  'Resumen de prueba para el renglón ya sembrado.',
  '2026-10-23T00:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;

select is(
  (select count(*)::int from public.blog_post where slug = 'react-essentials'),
  1,
  're-running the seed upserts instead of duplicating the row'
);

reset role;

select * from finish();

rollback;
