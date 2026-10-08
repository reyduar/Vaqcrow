begin;

select plan(47);

-- Public marketplace campaign read model (Feature #414, WU1).
--
-- `public.marketplace_campaign` is the server-side join of a published campaign
-- (a confirmed vault deployment on an `open` campaign) to its company and its
-- AI assessment. It is service_role-only: RLS on the base tables stays the
-- enforcement point, `security_invoker = true` keeps the view from bypassing it,
-- and there is no client (anon/authenticated) path at all.

-- Structure -------------------------------------------------------------------

select has_view('public', 'marketplace_campaign', 'marketplace_campaign view exists');

select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.marketplace_campaign'::regclass),
  true,
  'marketplace_campaign runs with security_invoker (honors base-table privileges)'
);

select has_column('public', 'marketplace_campaign', 'campaign_id', 'has a campaign_id column');
select has_column('public', 'marketplace_campaign', 'name', 'has a name column');
select has_column('public', 'marketplace_campaign', 'sector', 'has a sector column');
select has_column('public', 'marketplace_campaign', 'city', 'has a city column');
select has_column('public', 'marketplace_campaign', 'goal_ars', 'has a goal_ars column');
select has_column('public', 'marketplace_campaign', 'revenue_share', 'has a revenue_share column');
select has_column('public', 'marketplace_campaign', 'total_stroops', 'has a total_stroops column');
select has_column('public', 'marketplace_campaign', 'goal_stroops', 'has a goal_stroops column');
select has_column('public', 'marketplace_campaign', 'deadline', 'has a deadline column');
select has_column('public', 'marketplace_campaign', 'risk_band', 'has a risk_band column');
select has_column('public', 'marketplace_campaign', 'risk_confidence', 'has a risk_confidence column');
select has_column('public', 'marketplace_campaign', 'fx_rate_version', 'has an fx_rate_version column');
select has_column('public', 'marketplace_campaign', 'usd_to_ars', 'has a usd_to_ars column');
select has_column('public', 'marketplace_campaign', 'stroops_per_usd', 'has a stroops_per_usd column');
select has_column('public', 'marketplace_campaign', 'image_object_path', 'has an image_object_path column (#414/WU3)');
select has_column('public', 'marketplace_campaign', 'image_content_type', 'has an image_content_type column (#414/WU3)');
select col_type_is('public', 'marketplace_campaign', 'image_object_path', 'text', 'image_object_path is text');
select col_type_is('public', 'marketplace_campaign', 'image_content_type', 'text', 'image_content_type is text');

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.marketplace_campaign', 'select'), false, 'anon cannot read marketplace_campaign');
select is(has_table_privilege('authenticated', 'public.marketplace_campaign', 'select'), false, 'authenticated cannot read marketplace_campaign');
select is(has_table_privilege('service_role', 'public.marketplace_campaign', 'select'), true, 'service role can read marketplace_campaign');

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------
-- Two published campaigns (one with an assessment, one without), a campaign
-- still pending deployment, and a settled campaign. Only the first two are
-- published.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('e1111111-1111-4111-8111-111111111111', 'market-a@example.test', '{"role": "PYME", "display_name": "Market A"}'::jsonb, '{}'::jsonb),
  ('e2222222-2222-4222-8222-222222222222', 'market-b@example.test', '{"role": "PYME", "display_name": "Market B"}'::jsonb, '{}'::jsonb),
  ('e3333333-3333-4333-8333-333333333333', 'market-c@example.test', '{"role": "PYME", "display_name": "Market C"}'::jsonb, '{}'::jsonb),
  ('e4444444-4444-4444-8444-444444444444', 'market-d@example.test', '{"role": "PYME", "display_name": "Market D"}'::jsonb, '{}'::jsonb);

insert into public.businesses (owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share)
values
  ('e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20111111111', 'Alimentos', 'CABA', 'Panadería artesanal', 5000000, 5),
  ('e2222222-2222-4222-8222-222222222222', 'Panadería Norte', '20222222222', 'Alimentos', 'Córdoba', 'Panadería artesanal', 8000000, 3),
  ('e3333333-3333-4333-8333-333333333333', 'Panadería Oeste', '20333333333', 'Alimentos', 'Mendoza', 'Panadería artesanal', 6000000, 4),
  ('e4444444-4444-4444-8444-444444444444', 'Panadería Sur', '20444444444', 'Alimentos', 'Rosario', 'Panadería artesanal', 7000000, 6);

insert into public.application_review (application_id, state, last_correlation_id)
values
  ('a1111111-1111-4111-8111-111111111111', 'approved', 'b1111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222', 'approved', 'b2222222-2222-4222-8222-222222222222'),
  ('a3333333-3333-4333-8333-333333333333', 'approved', 'b3333333-3333-4333-8333-333333333333'),
  ('a4444444-4444-4444-8444-444444444444', 'approved', 'b4444444-4444-4444-8444-444444444444');

insert into public.sme_request (application_id, sme_reference, declared_total_ars, period_start, period_end, correlation_id, owner_user_id)
values
  ('a1111111-1111-4111-8111-111111111111', 'sme:A', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-aaaaaaaaaaaa', 'e1111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222', 'sme:B', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-bbbbbbbbbbbb', 'e2222222-2222-4222-8222-222222222222'),
  ('a3333333-3333-4333-8333-333333333333', 'sme:C', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-cccccccccccc', 'e3333333-3333-4333-8333-333333333333'),
  ('a4444444-4444-4444-8444-444444444444', 'sme:D', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-dddddddddddd', 'e4444444-4444-4444-8444-444444444444');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address, sme_account_id,
  goal_stroops, deadline, state, total_stroops, reconciliation_status, last_reconciled_at,
  last_correlation_id, fx_rate_version, usd_to_ars, stroops_per_usd
) values
  (
    'c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'CAAAAA', 'testnet', 'CBBBBB',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-12-01 00:00:00+00', 'open', 2500000, 'in_sync', now(),
    '11111111-1111-4111-8111-111111111111', 5, 1000000000, 10000000
  ),
  (
    'c2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'CAAAA2', 'testnet', 'CBBBB2',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-11-01 00:00:00+00', 'open', 0, 'in_sync', now(),
    '11111111-1111-4111-8111-222222222222', null, null, null
  ),
  (
    'c3333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333', 'CAAAA3', 'testnet', 'CBBBB3',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-20 00:00:00+00', 'open', 0, 'in_sync', now(),
    '11111111-1111-4111-8111-333333333333', 5, 1000000000, 10000000
  ),
  (
    'c4444444-4444-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444', 'CAAAA4', 'testnet', 'CBBBB4',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-10 00:00:00+00', 'settled', 10000000, 'in_sync', now(),
    '11111111-1111-4111-8111-444444444444', 5, 1000000000, 10000000
  );

insert into public.campaign_deployment (application_id, state, attempts, campaign_id, last_correlation_id)
values
  ('a1111111-1111-4111-8111-111111111111', 'confirmed', 1, 'c1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222', 'confirmed', 1, 'c2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-222222222222'),
  ('a3333333-3333-4333-8333-333333333333', 'pending', 0, null, '11111111-1111-4111-8111-333333333333'),
  ('a4444444-4444-4444-8444-444444444444', 'confirmed', 1, 'c4444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-444444444444');

insert into public.application_assessment (application_id, attempt_id, assessment, metadata, correlation_id)
values (
  'a1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  '{"assessmentId":"asm_mkt_001","riskBand":"medium","confidence":0.72}'::jsonb,
  '{}'::jsonb,
  'f1111111-1111-4111-8111-111111111111'
);

-- Image fixtures (#414/WU3). Only a `photo` is ever eligible, never a required
-- document, even when that document was uploaded with an image content type.
--
-- Panadería Sol (published, c1) uploaded: a sales-declarations PDF; a CUIT scan
-- saved as JPEG (kind `cuit`, content type `image/jpeg`) that is OLDER than every
-- photo; and three photos. The CUIT scan is the oldest *image* by `created_at`,
-- so without the `kind = 'photo'` predicate it would be the row the lateral
-- selects — the regression this fixture pins.
--
-- Two photos tie on `created_at = 2026-02-01`; `id asc` must break the tie. The
-- row with the smallest id (`...101`) is inserted SECOND, so the tiebreak cannot
-- pass merely by physical/insertion order: only an explicit `id asc` picks it.
--
-- Panadería Norte (published, c2) uploaded a PDF and an image-typed required
-- document but no photo, so it must expose no image. Panadería Oeste (pending
-- deployment, c3) uploaded a photo that must stay unreachable because its
-- campaign is not published.
insert into public.pyme_document (id, owner_user_id, kind, object_path, name, size_bytes, content_type, created_at)
values
  (
    'a1111111-1111-4111-8111-1111111111f1', 'e1111111-1111-4111-8111-111111111111',
    'sales-declarations', 'e1111111-1111-4111-8111-111111111111/sales-declarations/decl.pdf',
    'declaraciones.pdf', 100, 'application/pdf', timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    'a1111111-1111-4111-8111-1111111111f2', 'e1111111-1111-4111-8111-111111111111',
    'cuit', 'e1111111-1111-4111-8111-111111111111/cuit/cuit.jpg',
    'cuit.jpg', 150, 'image/jpeg', timestamptz '2026-01-15 00:00:00+00'
  ),
  (
    'a1111111-1111-4111-8111-111111111102', 'e1111111-1111-4111-8111-111111111111',
    'photo', 'e1111111-1111-4111-8111-111111111111/photo/tie.png',
    'local.png', 300, 'image/png', timestamptz '2026-02-01 00:00:00+00'
  ),
  (
    'a1111111-1111-4111-8111-111111111101', 'e1111111-1111-4111-8111-111111111111',
    'photo', 'e1111111-1111-4111-8111-111111111111/photo/oldest.jpg',
    'frente.jpg', 200, 'image/jpeg', timestamptz '2026-02-01 00:00:00+00'
  ),
  (
    'a1111111-1111-4111-8111-111111111103', 'e1111111-1111-4111-8111-111111111111',
    'photo', 'e1111111-1111-4111-8111-111111111111/photo/newer.jpg',
    'deposito.jpg', 400, 'image/jpeg', timestamptz '2026-03-01 00:00:00+00'
  ),
  (
    'a2222222-2222-4222-8222-2222222222f1', 'e2222222-2222-4222-8222-222222222222',
    'cuit', 'e2222222-2222-4222-8222-222222222222/cuit/cuit.pdf',
    'cuit.pdf', 100, 'application/pdf', timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    'a2222222-2222-4222-8222-2222222222f2', 'e2222222-2222-4222-8222-222222222222',
    'articles-of-incorporation', 'e2222222-2222-4222-8222-222222222222/articles/articles.png',
    'estatuto.png', 120, 'image/png', timestamptz '2026-01-05 00:00:00+00'
  ),
  (
    'a3333333-3333-4333-8333-3333333333f1', 'e3333333-3333-4333-8333-333333333333',
    'photo', 'e3333333-3333-4333-8333-333333333333/photo/pending.jpg',
    'pendiente.jpg', 100, 'image/jpeg', timestamptz '2026-01-01 00:00:00+00'
  );

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as.

set local role service_role;

select is(
  (select count(*)::int from public.marketplace_campaign),
  2,
  'only the two published campaigns are listed'
);

select is(
  (select string_agg(name, ',' order by deadline) from public.marketplace_campaign),
  'Panadería Norte,Panadería Sol',
  'the listing carries one row per published campaign'
);

select is(
  (select name from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'Panadería Sol',
  'the company name comes from businesses'
);
select is(
  (select sector from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'Alimentos',
  'the company sector comes from businesses'
);
select is(
  (select city from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'CABA',
  'the company city comes from businesses'
);
select is(
  (select goal_ars from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  5000000::bigint,
  'the goal ARS comes from businesses.goal_ars'
);
select is(
  (select revenue_share from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  5::numeric,
  'the revenue share comes from businesses.revenue_share'
);
select is(
  (select total_stroops from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  2500000::bigint,
  'the raised total is the campaign mirror'
);
select is(
  (select goal_stroops from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  10000000::bigint,
  'the goal stroops is the campaign mirror'
);
select is(
  (select deadline from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  timestamptz '2026-12-01 00:00:00+00',
  'the close date is the campaign deadline'
);
select is(
  (select risk_band from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'medium',
  'the risk band comes from the AI assessment'
);
select is(
  (select risk_confidence from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  '0.72',
  'the risk confidence comes from the AI assessment'
);
select is(
  (select fx_rate_version from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  5::bigint,
  'the FX rate version snapshot is exposed'
);
select is(
  (select usd_to_ars from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  1000000000::bigint,
  'the usd_to_ars snapshot is exposed'
);
select is(
  (select stroops_per_usd from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  10000000::bigint,
  'the stroops_per_usd snapshot is exposed'
);

select is(
  (select risk_band from public.marketplace_campaign where campaign_id = 'c2222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without an assessment exposes a null risk band'
);
select is(
  (select risk_confidence from public.marketplace_campaign where campaign_id = 'c2222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without an assessment exposes a null risk confidence'
);
select is(
  (select fx_rate_version from public.marketplace_campaign where campaign_id = 'c2222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without a rate snapshot exposes nulls'
);

-- Image document (#414/WU3). Only a `photo` is eligible: the oldest by
-- `created_at`, then the smallest `id` (insertion order is deliberately not the
-- tiebreak). An older required document with an image content type is skipped.

select is(
  (select image_object_path from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'e1111111-1111-4111-8111-111111111111/photo/oldest.jpg',
  'the winning photo (oldest, then smallest id) is exposed'
);
select isnt(
  (select image_object_path from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'e1111111-1111-4111-8111-111111111111/cuit/cuit.jpg',
  'an older image-typed required document (cuit) is never served as the image'
);
select is(
  (select image_content_type from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'image/jpeg',
  'the image content type is exposed'
);
select is(
  (select image_object_path from public.marketplace_campaign where campaign_id = 'c2222222-2222-4222-8222-222222222222'),
  null,
  'a campaign with no photo (only a PDF and an image-typed required document) exposes no image'
);

select is(
  (select count(*)::int from public.marketplace_campaign where campaign_id = 'c3333333-3333-4333-8333-333333333333'),
  0,
  'a campaign with a pending deployment is not published'
);
select is(
  (select count(*)::int from public.marketplace_campaign where campaign_id = 'c4444444-4444-4444-8444-444444444444'),
  0,
  'a settled campaign is not published'
);

reset role;

select * from finish();
