begin;

select plan(57);

-- In-app notifications and email delivery bookkeeping (Feature #382, Task #383 /
-- T1a). This unit is the database foundation only; the notification service, the
-- in-app bell and the Resend email adapter land in later units.
--
-- `public.notification` is one row per event instance addressed to one
-- recipient. It is written exclusively by the API as `service_role`. The
-- idempotency guarantee is `(event_key, recipient_user_id)` unique, so a
-- retried producer cannot enqueue the same notification twice for the same
-- recipient. `event_type` is a catalogue key with NO CHECK: the catalogue
-- evolves and is validated in the application layer.
--
-- A signed-in user may SELECT only its own rows
-- (`recipient_user_id = auth.uid()`); there is no client write path at all.
-- `service_role` bypasses RLS and is the only writer.

-- Structure -------------------------------------------------------------------

select has_table('public', 'notification', 'notification table exists');

select has_column('public', 'notification', 'id', 'notification has an id column');
select has_column('public', 'notification', 'recipient_user_id', 'notification has a recipient_user_id column');
select has_column('public', 'notification', 'event_key', 'notification has an event_key column');
select has_column('public', 'notification', 'event_type', 'notification has an event_type column');
select has_column('public', 'notification', 'title', 'notification has a title column');
select has_column('public', 'notification', 'body', 'notification has a body column');
select has_column('public', 'notification', 'cta_label', 'notification has a cta_label column');
select has_column('public', 'notification', 'cta_href', 'notification has a cta_href column');
select has_column('public', 'notification', 'read_at', 'notification has a read_at column');
select has_column('public', 'notification', 'email_sent_at', 'notification has an email_sent_at column');
select has_column('public', 'notification', 'created_at', 'notification has a created_at column');

select col_type_is('public', 'notification', 'id', 'uuid', 'id is a uuid');
select col_type_is('public', 'notification', 'recipient_user_id', 'uuid', 'recipient_user_id is a uuid');
select col_type_is('public', 'notification', 'event_key', 'text', 'event_key is text');
select col_type_is('public', 'notification', 'event_type', 'text', 'event_type is text');
select col_type_is('public', 'notification', 'read_at', 'timestamp with time zone', 'read_at is a timestamptz');
select col_type_is('public', 'notification', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');

select col_not_null('public', 'notification', 'recipient_user_id', 'a notification always has a recipient');
select col_not_null('public', 'notification', 'event_key', 'a notification always has an event key');
select col_not_null('public', 'notification', 'event_type', 'a notification always has an event type');
select col_not_null('public', 'notification', 'title', 'a notification always has a title');
select col_not_null('public', 'notification', 'body', 'a notification always has a body');
select col_not_null('public', 'notification', 'created_at', 'a notification is always timestamped');
select col_is_null('public', 'notification', 'cta_label', 'cta_label is optional');
select col_is_null('public', 'notification', 'cta_href', 'cta_href is optional');
select col_is_null('public', 'notification', 'read_at', 'read_at is null until the recipient reads it');
select col_is_null('public', 'notification', 'email_sent_at', 'email_sent_at is null until the email is sent');

select col_has_default('public', 'notification', 'id', 'id generates its own uuid');
select col_has_default('public', 'notification', 'created_at', 'created_at defaults to now()');

select fk_ok(
  'public', 'notification', 'recipient_user_id',
  'public', 'profile', 'user_id',
  'notification.recipient_user_id references profile.user_id'
);

select has_index(
  'public', 'notification', 'notification_recipient_created_at_idx',
  'the newest-first listing index exists'
);
select has_index(
  'public', 'notification', 'notification_recipient_unread_idx',
  'the partial unread index exists'
);
select has_index(
  'public', 'notification', 'notification_event_recipient_key',
  'the (event_key, recipient) idempotency key is unique'
);

-- Access control: RLS on, one select-own policy, nobody but service_role writes --

select is(
  (select relrowsecurity from pg_class where oid = 'public.notification'::regclass),
  true,
  'notification has row-level security enabled'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'notification' and policyname = 'notification_select_own'),
  1,
  'the notification_select_own policy exists'
);
select is(
  (select cmd from pg_policies
    where schemaname = 'public' and tablename = 'notification' and policyname = 'notification_select_own'),
  'SELECT',
  'the policy is a SELECT policy'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'notification'),
  1,
  'there is no write policy: writes are service_role-only'
);

select is(has_table_privilege('anon', 'public.notification', 'select'), false, 'anon cannot read notifications');
select is(has_table_privilege('anon', 'public.notification', 'insert'), false, 'anon cannot insert notifications');
select is(has_table_privilege('anon', 'public.notification', 'update'), false, 'anon cannot update notifications');
select is(has_table_privilege('anon', 'public.notification', 'delete'), false, 'anon cannot delete notifications');
select is(has_table_privilege('authenticated', 'public.notification', 'select'), true, 'authenticated can read notifications (filtered by policy)');
select is(has_table_privilege('authenticated', 'public.notification', 'insert'), false, 'authenticated cannot insert notifications');
select is(has_table_privilege('authenticated', 'public.notification', 'update'), false, 'authenticated cannot update notifications');
select is(has_table_privilege('authenticated', 'public.notification', 'delete'), false, 'authenticated cannot delete notifications');
select is(has_table_privilege('service_role', 'public.notification', 'select'), true, 'service role can read notifications');
select is(has_table_privilege('service_role', 'public.notification', 'insert'), true, 'service role can insert notifications');
select is(has_table_privilege('service_role', 'public.notification', 'update'), true, 'service role can update notifications');
select is(has_table_privilege('service_role', 'public.notification', 'delete'), true, 'service role can delete notifications');

-- Behavior: idempotency --------------------------------------------------------
-- Exercised as service_role, the role the API connects as, so the write grants
-- the migration actually keeps are the ones under test. A profile is created by
-- the auth.users signup trigger, so the FK is exercised against real rows.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'notify-owner-a@example.test',
   '{"role": "INVERSOR", "display_name": "Notify Owner A"}'::jsonb, '{}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'notify-owner-b@example.test',
   '{"role": "INVERSOR", "display_name": "Notify Owner B"}'::jsonb, '{}'::jsonb);

set local role service_role;

insert into public.notification (recipient_user_id, event_key, event_type, title, body)
values (
  'a1111111-1111-4111-8111-111111111111', 'application:aaaa:submitted',
  'admin.new_application', 'Nueva solicitud', 'Una PyME envió su solicitud a revisión.'
);

select is(
  (select count(*)::int from public.notification
    where recipient_user_id = 'a1111111-1111-4111-8111-111111111111'),
  1,
  'a notification is enqueued for its recipient'
);

select throws_ok(
  $$insert into public.notification (recipient_user_id, event_key, event_type, title, body)
    values ('a1111111-1111-4111-8111-111111111111', 'application:aaaa:submitted',
            'admin.new_application', 'Nueva solicitud', 'Repetición')$$,
  '23505', null,
  'the same (event_key, recipient) cannot be enqueued twice'
);

select is(
  (select count(*)::int from public.notification
    where recipient_user_id = 'a2222222-2222-4222-8222-222222222222'
      and event_key = 'application:aaaa:submitted'),
  0,
  'the same event key is not yet enqueued for the other recipient'
);

insert into public.notification (recipient_user_id, event_key, event_type, title, body)
values (
  'a2222222-2222-4222-8222-222222222222', 'application:aaaa:submitted',
  'admin.new_application', 'Nueva solicitud', 'Una PyME envió su solicitud a revisión.'
);

select is(
  (select count(*)::int from public.notification
    where recipient_user_id = 'a2222222-2222-4222-8222-222222222222'
      and event_key = 'application:aaaa:submitted'),
  1,
  'the same event key is allowed for a different recipient'
);

-- RLS read semantics -----------------------------------------------------------
-- The select-own policy scopes a read to `recipient_user_id = auth.uid()`.

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*)::int from public.notification),
  1,
  'an authenticated recipient sees exactly its own notification'
);
select is(
  (select recipient_user_id::text from public.notification),
  'a1111111-1111-4111-8111-111111111111',
  'the visible row belongs to the caller'
);
select is(
  (select count(*)::int from public.notification
    where recipient_user_id = 'a2222222-2222-4222-8222-222222222222'),
  0,
  'another recipient''s notification is invisible'
);

reset role;

select * from finish();

rollback;
