-- Persisted PyME documents for the content-relevance (vision) check
-- (content-relevance/vision feature, unit U1). One row per upload: the API
-- validates the bytes, writes the object to the private `pyme-documents`
-- bucket and records the descriptor here. This row is what the future
-- content-relevance check (U5) resolves to find the objects it must read — the
-- upload response path alone is not queryable server-side.
--
-- `public.pyme_document` is service_role-only. RLS is enabled and the grants are
-- set explicitly in this same migration so no default anon/authenticated grant
-- ever survives even transiently, and there are ZERO policies on purpose: the
-- API connects as service_role (which bypasses RLS) and is the single ownership
-- enforcement point. It may read, create and delete a document (the upload and
-- its deletion) but never update it: a stored descriptor is immutable.
--
-- Reversal (no data outside this feature depends on it):
--   drop table if exists public.pyme_document;
create table public.pyme_document (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references public.profile(user_id) on delete cascade,
  kind           text not null,
  object_path    text not null unique,
  name           text not null,
  size_bytes     bigint not null,
  content_type   text not null,
  created_at     timestamptz not null default now(),
  constraint pyme_document_kind_check check (
    kind in ('sales-declarations', 'cuit', 'articles-of-incorporation', 'photo')
  ),
  constraint pyme_document_size_bytes_check check (size_bytes >= 0)
);

-- Backs the owner foreign key (no scan on profile maintenance) and the
-- owner-scoped listing the content-relevance check issues.
create index pyme_document_owner_user_id_idx on public.pyme_document (owner_user_id);

-- Access control: RLS on, grants explicit, no policies. service_role bypasses
-- RLS and is the API's role; it may read, create and delete documents but never
-- update one.
alter table public.pyme_document enable row level security;

revoke all on public.pyme_document from anon, authenticated, service_role;

grant select, insert, delete on public.pyme_document to service_role;
