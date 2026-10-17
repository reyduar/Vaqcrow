begin;

select plan(6);

-- Seed of the Stellar ecosystem Blog article (#599). The body lives in the
-- repository — `docs/guides/blog/ecosistema-stellar-de-vaqcrow.md` — and is
-- served by the API; the seed only registers its row in `public.blog_post`. It
-- is idempotent (`on conflict (slug) do update`), so the row exists exactly
-- once, is published and points at its Markdown source.

select is(
  (select count(*)::int from public.blog_post where slug = 'ecosistema-stellar-de-vaqcrow'),
  1,
  'the Stellar ecosystem article is registered exactly once'
);

select ok(
  (select published_at is not null from public.blog_post where slug = 'ecosistema-stellar-de-vaqcrow'),
  'the Stellar ecosystem article is published'
);

select is(
  (select source_path from public.blog_post where slug = 'ecosistema-stellar-de-vaqcrow'),
  'blog/ecosistema-stellar-de-vaqcrow.md',
  'the Stellar ecosystem article points at its Markdown source file'
);

select is(
  (select title from public.blog_post where slug = 'ecosistema-stellar-de-vaqcrow'),
  'El ecosistema Stellar de Vaqcrow, de la bóveda a tu wallet',
  'the Stellar ecosystem article carries its title'
);

select ok(
  (select summary <> '' from public.blog_post where slug = 'ecosistema-stellar-de-vaqcrow'),
  'the Stellar ecosystem article carries a summary'
);

-- Idempotency: re-running the seed's upsert must not duplicate the row.
set local role service_role;

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'ecosistema-stellar-de-vaqcrow',
  'blog/ecosistema-stellar-de-vaqcrow.md',
  'El ecosistema Stellar de Vaqcrow, de la bóveda a tu wallet',
  'Resumen de prueba para el renglón ya sembrado.',
  '2026-10-17T00:00:00Z'
)
on conflict (slug) do update
  set source_path = excluded.source_path,
      title = excluded.title,
      summary = excluded.summary,
      published_at = excluded.published_at;

select is(
  (select count(*)::int from public.blog_post where slug = 'ecosistema-stellar-de-vaqcrow'),
  1,
  're-running the seed upserts instead of duplicating the row'
);

reset role;

select * from finish();

rollback;
