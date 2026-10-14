begin;

select plan(39);

-- Blog in Markdown backed by `docs/guides` (Feature #498, Task T1a). This unit is
-- the database foundation only: the API adapter that serves the bundled Markdown
-- and the web pages land in later units.
--
-- `public.blog_post` maps a stable URL slug to a Markdown source file under
-- `docs/guides/` (the body itself lives in the repository, never in the
-- database). New articles are added by a migration/seed; there is no admin write
-- path, so the table is read exclusively by the API as `service_role` and never
-- by a browser session. `published_at` is null until an article is published, so
-- the API lists and serves only rows with a non-null `published_at`.
--
-- RLS is enabled with NO policy and no grant for `anon` or `authenticated`:
-- public blog content is served by the API, so neither role touches the table
-- directly.

-- Structure -------------------------------------------------------------------

select has_table('public', 'blog_post', 'blog_post table exists');

select has_column('public', 'blog_post', 'slug', 'blog_post has a slug column');
select has_column('public', 'blog_post', 'source_path', 'blog_post has a source_path column');
select has_column('public', 'blog_post', 'title', 'blog_post has a title column');
select has_column('public', 'blog_post', 'summary', 'blog_post has a summary column');
select has_column('public', 'blog_post', 'published_at', 'blog_post has a published_at column');
select has_column('public', 'blog_post', 'created_at', 'blog_post has a created_at column');

select col_type_is('public', 'blog_post', 'slug', 'text', 'slug is text');
select col_type_is('public', 'blog_post', 'source_path', 'text', 'source_path is text');
select col_type_is('public', 'blog_post', 'title', 'text', 'title is text');
select col_type_is('public', 'blog_post', 'summary', 'text', 'summary is text');
select col_type_is('public', 'blog_post', 'published_at', 'timestamp with time zone', 'published_at is a timestamptz');
select col_type_is('public', 'blog_post', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');

select col_not_null('public', 'blog_post', 'slug', 'a post always has a slug');
select col_not_null('public', 'blog_post', 'source_path', 'a post always names its source file');
select col_not_null('public', 'blog_post', 'title', 'a post always has a title');
select col_not_null('public', 'blog_post', 'summary', 'a post always has a summary');
select col_not_null('public', 'blog_post', 'created_at', 'a post is always timestamped');
select col_is_null('public', 'blog_post', 'published_at', 'published_at is null until the post is published');
select col_has_default('public', 'blog_post', 'created_at', 'created_at defaults to now()');

select has_index('public', 'blog_post', 'blog_post_pkey', 'the slug primary key exists');
select has_index('public', 'blog_post', 'blog_post_published_at_idx', 'the published listing index exists');

-- Access control: RLS on, no policy, nobody but service_role touches the table --

select is(
  (select relrowsecurity from pg_class where oid = 'public.blog_post'::regclass),
  true,
  'blog_post has row-level security enabled'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'blog_post'),
  0,
  'blog_post has no policy: it is API-only'
);

select is(has_table_privilege('anon', 'public.blog_post', 'select'), false, 'anon cannot read blog_post');
select is(has_table_privilege('anon', 'public.blog_post', 'insert'), false, 'anon cannot insert blog_post');
select is(has_table_privilege('anon', 'public.blog_post', 'update'), false, 'anon cannot update blog_post');
select is(has_table_privilege('anon', 'public.blog_post', 'delete'), false, 'anon cannot delete blog_post');
select is(has_table_privilege('authenticated', 'public.blog_post', 'select'), false, 'authenticated cannot read blog_post');
select is(has_table_privilege('authenticated', 'public.blog_post', 'insert'), false, 'authenticated cannot insert blog_post');
select is(has_table_privilege('authenticated', 'public.blog_post', 'update'), false, 'authenticated cannot update blog_post');
select is(has_table_privilege('authenticated', 'public.blog_post', 'delete'), false, 'authenticated cannot delete blog_post');
select is(has_table_privilege('service_role', 'public.blog_post', 'select'), true, 'service role can read blog_post');
select is(has_table_privilege('service_role', 'public.blog_post', 'insert'), true, 'service role can insert blog_post');
select is(has_table_privilege('service_role', 'public.blog_post', 'update'), true, 'service role can update blog_post');
select is(has_table_privilege('service_role', 'public.blog_post', 'delete'), true, 'service role can delete blog_post');

-- Behavior ---------------------------------------------------------------------

set local role service_role;

insert into public.blog_post (slug, source_path, title, summary, published_at)
values (
  'vaqcrow-sobre-stellar',
  'blog/vaqcrow-sobre-stellar.md',
  'Vaqcrow sobre Stellar',
  'Cómo Vaqcrow financia PyMEs con una bóveda Soroban en Testnet.',
  now()
);

select is(
  (select count(*)::int from public.blog_post where slug = 'vaqcrow-sobre-stellar'),
  1,
  'a published post is stored with its slug and source path'
);

select throws_ok(
  $$insert into public.blog_post (slug, source_path, title, summary)
    values ('vaqcrow-sobre-stellar', 'blog/duplicado.md', 'Duplicado', 'Otro')$$,
  '23505', null,
  'the same slug cannot be inserted twice'
);

reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.blog_post$$,
  '42501', null,
  'an anonymous session cannot read the table directly'
);
reset role;

select * from finish();

rollback;
