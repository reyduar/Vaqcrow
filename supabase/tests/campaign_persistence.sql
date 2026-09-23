begin;

select plan(17);

select has_table('public', 'campaign', 'campaign mirror exists');
select has_table('public', 'campaign_contribution', 'contribution mirror exists');
select has_table('public', 'campaign_refund_contact', 'refund contact store exists');
select has_table('public', 'funding_intent_legacy', 'legacy funding evidence remains readable');
select hasnt_table('public', 'funding_intent', 'retired funding table is not active');

select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign'::regclass),
  true,
  'campaign has row-level security enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign_contribution'::regclass),
  true,
  'campaign contributions have row-level security enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign_refund_contact'::regclass),
  true,
  'refund contacts have row-level security enabled'
);

select is(
  has_table_privilege('anon', 'public.campaign', 'select'),
  false,
  'anon cannot read campaign mirrors'
);
select is(
  has_table_privilege('authenticated', 'public.campaign_contribution', 'insert'),
  false,
  'authenticated cannot write contribution mirrors'
);
select is(
  has_table_privilege('anon', 'public.campaign_refund_contact', 'select'),
  false,
  'anon cannot read refund contact PII'
);
select is(
  has_table_privilege('service_role', 'public.campaign', 'update'),
  true,
  'service role can reconcile campaigns'
);
select is(
  has_table_privilege('service_role', 'public.campaign_contribution', 'update'),
  true,
  'service role can reconcile contributions'
);
select is(
  has_table_privilege('service_role', 'public.campaign_refund_contact', 'insert'),
  true,
  'service role can save refund contacts'
);
select is(
  has_table_privilege('service_role', 'public.funding_intent_legacy', 'select'),
  true,
  'service role can inspect legacy evidence'
);

-- Exercise the documented reversal in an isolated transaction. The rollback
-- keeps the test database at the forward migration state for later tests.
drop table public.campaign_refund_contact;
drop table public.campaign_contribution;
drop table public.campaign;
drop function public.set_campaign_updated_at();
alter table public.funding_intent_legacy rename to funding_intent;

select hasnt_table('public', 'campaign', 'reversal removes campaign mirror');
select has_table('public', 'funding_intent', 'reversal restores the legacy table name');

select * from finish();

rollback;
