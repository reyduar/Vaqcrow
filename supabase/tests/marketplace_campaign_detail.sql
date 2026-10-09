begin;

select plan(74);

-- Account-gated campaign detail read model (Feature #422, WU1).
--
-- `public.marketplace_campaign_detail` is the server-side join of a published
-- campaign (a confirmed vault deployment on an `open` campaign) to its company,
-- its AI assessment, its latest human decision, its mirrored contributors and
-- its real photo. It is service_role-only: RLS on the base tables stays the
-- enforcement point, `security_invoker = true` keeps the view from bypassing it,
-- and there is no client (anon/authenticated) path at all.

-- Structure -------------------------------------------------------------------

select has_view('public', 'marketplace_campaign_detail', 'marketplace_campaign_detail view exists');

select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.marketplace_campaign_detail'::regclass),
  true,
  'marketplace_campaign_detail runs with security_invoker (honors base-table privileges)'
);

select has_column('public', 'marketplace_campaign_detail', 'campaign_id', 'has a campaign_id column');
select has_column('public', 'marketplace_campaign_detail', 'name', 'has a name column');
select has_column('public', 'marketplace_campaign_detail', 'sector', 'has a sector column');
select has_column('public', 'marketplace_campaign_detail', 'city', 'has a city column');
select has_column('public', 'marketplace_campaign_detail', 'description', 'has a description column');
select has_column('public', 'marketplace_campaign_detail', 'founded_at', 'has a founded_at column');
select has_column('public', 'marketplace_campaign_detail', 'goal_ars', 'has a goal_ars column');
select has_column('public', 'marketplace_campaign_detail', 'total_stroops', 'has a total_stroops column');
select has_column('public', 'marketplace_campaign_detail', 'goal_stroops', 'has a goal_stroops column');
select has_column('public', 'marketplace_campaign_detail', 'revenue_share', 'has a revenue_share column');
select has_column('public', 'marketplace_campaign_detail', 'deadline', 'has a deadline column');
select has_column('public', 'marketplace_campaign_detail', 'state', 'has a state column');
select has_column('public', 'marketplace_campaign_detail', 'vault_address', 'has a vault_address column');
select has_column('public', 'marketplace_campaign_detail', 'backers', 'has a backers column');
select has_column('public', 'marketplace_campaign_detail', 'assessment_present', 'has an assessment_present column');
select has_column('public', 'marketplace_campaign_detail', 'assessment_risk_band', 'has an assessment_risk_band column');
select has_column('public', 'marketplace_campaign_detail', 'assessment_confidence', 'has an assessment_confidence column');
select has_column('public', 'marketplace_campaign_detail', 'assessment_reasons', 'has an assessment_reasons column');
select has_column('public', 'marketplace_campaign_detail', 'assessment_model', 'has an assessment_model column');
select has_column('public', 'marketplace_campaign_detail', 'assessment_generated_at', 'has an assessment_generated_at column');
select has_column('public', 'marketplace_campaign_detail', 'decision_actor', 'has a decision_actor column');
select has_column('public', 'marketplace_campaign_detail', 'decision_reason', 'has a decision_reason column');
select has_column('public', 'marketplace_campaign_detail', 'decision_approved_limit_ars', 'has a decision_approved_limit_ars column');
select has_column('public', 'marketplace_campaign_detail', 'decision_recorded_at', 'has a decision_recorded_at column');
select has_column('public', 'marketplace_campaign_detail', 'image_object_path', 'has an image_object_path column');
select has_column('public', 'marketplace_campaign_detail', 'image_content_type', 'has an image_content_type column');
select has_column('public', 'marketplace_campaign_detail', 'fx_rate_version', 'has an fx_rate_version column');
select has_column('public', 'marketplace_campaign_detail', 'usd_to_ars', 'has a usd_to_ars column');
select has_column('public', 'marketplace_campaign_detail', 'stroops_per_usd', 'has a stroops_per_usd column');

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.marketplace_campaign_detail', 'select'), false, 'anon cannot read marketplace_campaign_detail');
select is(has_table_privilege('authenticated', 'public.marketplace_campaign_detail', 'select'), false, 'authenticated cannot read marketplace_campaign_detail');
select is(has_table_privilege('service_role', 'public.marketplace_campaign_detail', 'select'), true, 'service role can read marketplace_campaign_detail');

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------
-- Two published campaigns: one fully populated (company + assessment + two
-- decisions + contributions + photo + FX snapshot), one bare (no assessment, no
-- decision, no contribution, no photo, no snapshot). A campaign still pending
-- deployment and a settled campaign are not published.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('71111111-1111-4111-8111-111111111111', 'detail-a@example.test', '{"role": "PYME", "display_name": "Detail A"}'::jsonb, '{}'::jsonb),
  ('72222222-2222-4222-8222-222222222222', 'detail-b@example.test', '{"role": "PYME", "display_name": "Detail B"}'::jsonb, '{}'::jsonb),
  ('73333333-3333-4333-8333-333333333333', 'detail-c@example.test', '{"role": "PYME", "display_name": "Detail C"}'::jsonb, '{}'::jsonb),
  ('74444444-4444-4444-8444-444444444444', 'detail-d@example.test', '{"role": "PYME", "display_name": "Detail D"}'::jsonb, '{}'::jsonb);

insert into public.businesses (owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share, created_at)
values
  ('71111111-1111-4111-8111-111111111111', 'Panadería Sol', '20111111111', 'Alimentos', 'CABA', 'Panadería artesanal con tres locales', 5000000, 5, timestamptz '2024-03-01 00:00:00+00'),
  ('72222222-2222-4222-8222-222222222222', 'Panadería Norte', '20222222222', 'Alimentos', 'Córdoba', 'Panadería artesanal', 8000000, 3, timestamptz '2024-04-01 00:00:00+00'),
  ('73333333-3333-4333-8333-333333333333', 'Panadería Oeste', '20333333333', 'Alimentos', 'Mendoza', 'Panadería artesanal', 6000000, 4, timestamptz '2024-05-01 00:00:00+00'),
  ('74444444-4444-4444-8444-444444444444', 'Panadería Sur', '20444444444', 'Alimentos', 'Rosario', 'Panadería artesanal', 7000000, 6, timestamptz '2024-06-01 00:00:00+00');

insert into public.application_review (application_id, state, last_correlation_id)
values
  ('71111111-1111-4111-8111-111111111111', 'approved', 'b1111111-1111-4111-8111-111111111111'),
  ('72222222-2222-4222-8222-222222222222', 'approved', 'b2222222-2222-4222-8222-222222222222'),
  ('73333333-3333-4333-8333-333333333333', 'approved', 'b3333333-3333-4333-8333-333333333333'),
  ('74444444-4444-4444-8444-444444444444', 'approved', 'b4444444-4444-4444-8444-444444444444');

insert into public.sme_request (application_id, sme_reference, declared_total_ars, period_start, period_end, correlation_id, owner_user_id)
values
  ('71111111-1111-4111-8111-111111111111', 'sme:A', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-aaaaaaaaaaaa', '71111111-1111-4111-8111-111111111111'),
  ('72222222-2222-4222-8222-222222222222', 'sme:B', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-bbbbbbbbbbbb', '72222222-2222-4222-8222-222222222222'),
  ('73333333-3333-4333-8333-333333333333', 'sme:C', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-cccccccccccc', '73333333-3333-4333-8333-333333333333'),
  ('74444444-4444-4444-8444-444444444444', 'sme:D', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-dddddddddddd', '74444444-4444-4444-8444-444444444444');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address, sme_account_id,
  goal_stroops, deadline, state, total_stroops, reconciliation_status, last_reconciled_at,
  last_correlation_id, fx_rate_version, usd_to_ars, stroops_per_usd
) values
  (
    '71111111-1111-4111-8111-111111111111', '71111111-1111-4111-8111-111111111111',
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM', 'testnet',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-12-01 00:00:00+00', 'open', 2500000, 'in_sync', now(),
    '11111111-1111-4111-8111-111111111111', 5, 1000000000, 10000000
  ),
  (
    '72222222-2222-4222-8222-222222222222', '72222222-2222-4222-8222-222222222222',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', 'testnet',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-11-01 00:00:00+00', 'open', 0, 'in_sync', now(),
    '11111111-1111-4111-8111-222222222222', null, null, null
  ),
  (
    '73333333-3333-4333-8333-333333333333', '73333333-3333-4333-8333-333333333333',
    'CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDWHF', 'testnet',
    'CEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEWHF',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-20 00:00:00+00', 'open', 0, 'in_sync', now(),
    '11111111-1111-4111-8111-333333333333', 5, 1000000000, 10000000
  ),
  (
    '74444444-4444-4444-8444-444444444444', '74444444-4444-4444-8444-444444444444',
    'CFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFWHF', 'testnet',
    'CGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWHF',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-10 00:00:00+00', 'settled', 10000000, 'in_sync', now(),
    '11111111-1111-4111-8111-444444444444', 5, 1000000000, 10000000
  );

insert into public.campaign_deployment (application_id, state, attempts, campaign_id, last_correlation_id)
values
  ('71111111-1111-4111-8111-111111111111', 'confirmed', 1, '71111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('72222222-2222-4222-8222-222222222222', 'confirmed', 1, '72222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-222222222222'),
  ('73333333-3333-4333-8333-333333333333', 'pending', 0, null, '11111111-1111-4111-8111-333333333333'),
  ('74444444-4444-4444-8444-444444444444', 'confirmed', 1, '74444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-444444444444');

-- The AI assessment for the first campaign only; the second has none.
insert into public.application_assessment (application_id, attempt_id, assessment, metadata, correlation_id)
values (
  '71111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  '{
    "assessmentId": "asm_detail_001",
    "riskBand": "medium",
    "confidence": 0.72,
    "reasons": [
      {"claim": "Ventas declaradas consistentes con los documentos.", "evidenceRefs": [{"kind": "document", "ref": "doc-1"}]},
      {"claim": "Antigüedad suficiente del negocio.", "evidenceRefs": [{"kind": "document", "ref": "doc-2"}]}
    ]
  }'::jsonb,
  '{"model": "simulated-v1", "promptVersion": "prompt-v1", "generatedAt": "2026-09-30T12:00:00.000Z", "source": "simulated"}'::jsonb,
  'f1111111-1111-4111-8111-111111111111'
);

-- Two human decisions for the first campaign; the latest must win. The second
-- campaign has none.
insert into public.human_decision (decision_id, application_id, outcome, actor, reason, approved_limit_ars, decided_at, correlation_id)
values
  (
    'd1111111-1111-4111-8111-111111111101', '71111111-1111-4111-8111-111111111111',
    'approved', 'Admin Anterior', 'Primera revisión', 4000000, timestamptz '2026-09-20 00:00:00+00',
    'f1111111-1111-4111-8111-111111111101'
  ),
  (
    'd1111111-1111-4111-8111-111111111102', '71111111-1111-4111-8111-111111111111',
    'approved', 'Admin Vaqcrow', 'Aprobada tras revisar la evidencia.', 5000000, timestamptz '2026-10-01 00:00:00+00',
    'f1111111-1111-4111-8111-111111111102'
  );

-- Two mirrored contributors for the first campaign.
insert into public.campaign_contribution (campaign_id, investor_account_id, amount_stroops, last_observed_at, last_correlation_id)
values
  ('71111111-1111-4111-8111-111111111111', 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 1500000, now(), '11111111-1111-4111-8111-aaaa00000001'),
  ('71111111-1111-4111-8111-111111111111', 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 1000000, now(), '11111111-1111-4111-8111-aaaa00000002');

-- A required CUIT document saved as an image OLDER than the photo, plus the
-- photo itself: only the `kind = 'photo'` row may be exposed.
insert into public.pyme_document (id, owner_user_id, kind, object_path, name, size_bytes, content_type, created_at)
values
  (
    'a1111111-1111-4111-8111-1111111117f1', '71111111-1111-4111-8111-111111111111',
    'cuit', '71111111-1111-4111-8111-111111111111/cuit/cuit.jpg',
    'cuit.jpg', 100, 'image/jpeg', timestamptz '2026-01-10 00:00:00+00'
  ),
  (
    'a1111111-1111-4111-8111-1111111117f2', '71111111-1111-4111-8111-111111111111',
    'photo', '71111111-1111-4111-8111-111111111111/photo/frente.jpg',
    'frente.jpg', 200, 'image/jpeg', timestamptz '2026-02-01 00:00:00+00'
  );

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as.

set local role service_role;

select is(
  (select count(*)::int from public.marketplace_campaign_detail),
  2,
  'only the two published campaigns are exposed'
);

select is(
  (select string_agg(name, ',' order by deadline) from public.marketplace_campaign_detail),
  'Panadería Norte,Panadería Sol',
  'one row per published campaign, ordered by deadline in the aggregate'
);

select is(
  (select name from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'Panadería Sol',
  'the company name comes from businesses'
);
select is(
  (select sector from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'Alimentos',
  'the company sector comes from businesses'
);
select is(
  (select city from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'CABA',
  'the company city comes from businesses'
);
select is(
  (select description from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'Panadería artesanal con tres locales',
  'the description ("Sobre la PyME") comes from businesses'
);
select is(
  (select founded_at from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  timestamptz '2024-03-01 00:00:00+00',
  'the "Desde" date comes from businesses.created_at'
);
select is(
  (select goal_ars from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  5000000::bigint,
  'the goal ARS comes from businesses.goal_ars'
);
select is(
  (select revenue_share from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  5::numeric,
  'the revenue share comes from businesses.revenue_share'
);
select is(
  (select total_stroops from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  2500000::bigint,
  'the raised total is the campaign mirror'
);
select is(
  (select goal_stroops from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  10000000::bigint,
  'the goal stroops is the campaign mirror'
);
select is(
  (select deadline from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  timestamptz '2026-12-01 00:00:00+00',
  'the close date is the campaign deadline'
);
select is(
  (select state from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'open',
  'the persisted campaign state is exposed'
);
select is(
  (select vault_address from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
  'the vault address is the persisted campaign contract_address'
);
select is(
  (select backers from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  2::bigint,
  'backers counts the mirrored contributors'
);

select is(
  (select assessment_present from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  true,
  'a campaign with an assessment reports it as present'
);
select is(
  (select assessment_risk_band from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'medium',
  'the assessment risk band is exposed'
);
select is(
  (select assessment_confidence from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  '0.72',
  'the assessment confidence is exposed'
);
select is(
  (select assessment_reasons from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  '["Ventas declaradas consistentes con los documentos.","Antigüedad suficiente del negocio."]'::jsonb,
  'the assessment reasons are reduced to their claim strings, in order'
);
select is(
  (select assessment_model from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'simulated-v1',
  'the assessment model provenance is exposed'
);
select is(
  (select assessment_generated_at from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  timestamptz '2026-09-30 12:00:00+00',
  'the assessment generation time is exposed'
);

select is(
  (select decision_actor from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'Admin Vaqcrow',
  'the latest human decision actor wins'
);
select is(
  (select decision_reason from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'Aprobada tras revisar la evidencia.',
  'the latest human decision reason is exposed'
);
select is(
  (select decision_approved_limit_ars from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  5000000::bigint,
  'the latest human decision approved limit is exposed'
);
select is(
  (select decision_recorded_at from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  timestamptz '2026-10-01 00:00:00+00',
  'the latest human decision server date is exposed'
);

select is(
  (select image_object_path from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  '71111111-1111-4111-8111-111111111111/photo/frente.jpg',
  'the photo (not the older image-typed CUIT document) is exposed'
);
select isnt(
  (select image_object_path from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  '71111111-1111-4111-8111-111111111111/cuit/cuit.jpg',
  'an older image-typed required document is never served as the photo'
);
select is(
  (select image_content_type from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  'image/jpeg',
  'the photo content type is exposed'
);

select is(
  (select fx_rate_version from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  5::bigint,
  'the FX rate version snapshot is exposed'
);
select is(
  (select usd_to_ars from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  1000000000::bigint,
  'the usd_to_ars snapshot is exposed'
);
select is(
  (select stroops_per_usd from public.marketplace_campaign_detail where campaign_id = '71111111-1111-4111-8111-111111111111'),
  10000000::bigint,
  'the stroops_per_usd snapshot is exposed'
);

select is(
  (select assessment_present from public.marketplace_campaign_detail where campaign_id = '72222222-2222-4222-8222-222222222222'),
  false,
  'a campaign without an assessment reports it absent'
);
select is(
  (select assessment_risk_band from public.marketplace_campaign_detail where campaign_id = '72222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without an assessment exposes a null risk band'
);
select is(
  (select assessment_reasons from public.marketplace_campaign_detail where campaign_id = '72222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without an assessment exposes null reasons'
);
select is(
  (select decision_actor from public.marketplace_campaign_detail where campaign_id = '72222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without a decision exposes a null actor'
);
select is(
  (select backers from public.marketplace_campaign_detail where campaign_id = '72222222-2222-4222-8222-222222222222'),
  0::bigint,
  'a campaign with no contributors exposes zero backers'
);
select is(
  (select image_object_path from public.marketplace_campaign_detail where campaign_id = '72222222-2222-4222-8222-222222222222'),
  null,
  'a campaign whose PyME has no photo exposes no image'
);
select is(
  (select fx_rate_version from public.marketplace_campaign_detail where campaign_id = '72222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without a rate snapshot exposes nulls'
);

select is(
  (select count(*)::int from public.marketplace_campaign_detail where campaign_id = '73333333-3333-4333-8333-333333333333'),
  0,
  'a campaign with a pending deployment is not published'
);
select is(
  (select count(*)::int from public.marketplace_campaign_detail where campaign_id = '74444444-4444-4444-8444-444444444444'),
  0,
  'a settled campaign is not published'
);

reset role;

select * from finish();
