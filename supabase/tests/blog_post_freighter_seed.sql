begin;

select plan(6);

-- Seed of the Freighter + Friendbot Blog article (Feature #558). The body lives
-- in the repository — `docs/guides/blog/freighter-y-friendbot-paso-a-paso.md` —
-- and is served by the API; the seed only registers its row in
-- `public.blog_post`. It is idempotent (`on conflict (slug) do update`), so the
-- row exists exactly once, is published and points at its Markdown source.

select is(
  (select count(*)::int from public.blog_post where slug = 'freighter-y-friendbot-paso-a-paso'),
  1,
  'the Freighter article is registered exactly once'
);

select ok(
  (select published_at is not null from public.blog_post where slug = 'freighter-y-friendbot-paso-a-paso'),
  'the Freighter article is published'
);

select is(
  (select source_path from public.blog_post where slug = 'freighter-y-friendbot-paso-a-paso'),
  'blog/freighter-y-friendbot-paso-a-paso.md',
  'the Freighter article points at its Markdown source file'
);

select is(
  (select title from public.blog_post where slug = 'freighter-y-friendbot-paso-a-paso'),
  'Freighter y Friendbot, paso a paso: tu wallet de Testnet en Chrome',
  'the Freighter article carries its title'
);

select ok(
  (select summary <> '' from public.blog_post where slug = 'freighter-y-friendbot-paso-a-paso'),
  'the Freighter article carries a summary'
);

-- Idempotency: re-running the seed's upsert must not duplicate the row.
set local role service_role;

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'freighter-y-friendbot-paso-a-paso',
  'blog/freighter-y-friendbot-paso-a-paso.md',
  'Freighter y Friendbot, paso a paso: tu wallet de Testnet en Chrome',
  'Resumen de prueba para el renglón ya sembrado.',
  '2026-10-16T00:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;

select is(
  (select count(*)::int from public.blog_post where slug = 'freighter-y-friendbot-paso-a-paso'),
  1,
  're-running the seed upserts instead of duplicating the row'
);

reset role;

select * from finish();

rollback;
