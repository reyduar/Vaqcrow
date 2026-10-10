-- In-app notifications and email delivery bookkeeping (Feature #382, Task #383 /
-- T1a). This migration is the database foundation only; the notification
-- service, the in-app bell and the Resend email adapter land in later units.
--
-- `public.notification` is one row per event instance addressed to one
-- recipient. It is written exclusively by the API as `service_role`, which
-- enqueues a row when an event occurs and stamps `email_sent_at` once Resend
-- has accepted the message. A signed-in user may only read their own rows.
--
-- Idempotency: `(event_key, recipient_user_id)` is unique. `event_key` is the
-- stable identifier of the event instance (for example
-- `application:<uuid>:submitted`), so a retried producer cannot enqueue the
-- same notification twice for the same recipient. `event_type` is a catalogue
-- key (`admin.new_application`, ...) and deliberately has NO CHECK constraint:
-- the catalogue evolves with the product and is validated in the application
-- layer, so the database must not reject a type the API already knows about.
--
-- Read state: `read_at` is null until the recipient opens the notification; a
-- partial index over the unread rows serves the badge count. `email_sent_at`
-- records delivery, not intent, so a null value means "not emailed yet".
--
-- RLS: enabled with exactly one policy. `authenticated` may SELECT only rows
-- whose `recipient_user_id = auth.uid()`; admin-addressed notifications carry
-- the admin's own user_id as recipient, so no additional policy is needed.
-- There is no INSERT/UPDATE/DELETE policy and no write grant for
-- `authenticated`. All writes are `service_role`-only.
--
-- Migration workflow: this file is authored and verified against the local
-- stack first (`supabase migration up --local`, then `pnpm run test:db`), and
-- is only applied to the remote Supabase project afterwards, in the same work
-- unit, once the local suite is green.
--
-- Reversal (no data outside this feature depends on it):
--   drop policy if exists notification_select_own on public.notification;
--   drop table if exists public.notification;

create table public.notification (
  id                 uuid primary key default gen_random_uuid(),
  recipient_user_id  uuid not null references public.profile(user_id) on delete cascade,
  -- Stable idempotency key of the event instance, e.g.
  -- 'application:<uuid>:submitted'.
  event_key          text not null,
  -- Catalogue key (e.g. 'admin.new_application'). No CHECK on purpose: the
  -- catalogue evolves and is validated in the application layer.
  event_type         text not null,
  title              text not null,
  body               text not null,
  cta_label          text,
  cta_href           text,
  read_at            timestamptz,
  email_sent_at      timestamptz,
  created_at         timestamptz not null default now(),
  constraint notification_event_recipient_key unique (event_key, recipient_user_id)
);

-- Listing a recipient's notifications newest-first (the bell dropdown). The
-- composite order matches the query's WHERE + ORDER BY so the read is a single
-- index scan.
create index notification_recipient_created_at_idx
  on public.notification (recipient_user_id, created_at desc);

-- Unread badge count. Partial on `read_at is null` so it stays proportional to
-- the outstanding unread rows, not to the recipient's full history.
create index notification_recipient_unread_idx
  on public.notification (recipient_user_id)
  where read_at is null;

-- Access control: RLS on, grants explicit in this same migration so no default
-- anon/authenticated grant ever survives even transiently.
alter table public.notification enable row level security;

revoke all on public.notification from anon, authenticated, service_role;

-- Writes are service_role-only: the API enqueues, marks read and records email.
grant all on public.notification to service_role;

-- A signed-in user may read only their own rows; the policy below scopes this
-- grant to `recipient_user_id = auth.uid()`.
grant select on public.notification to authenticated;

create policy notification_select_own on public.notification
  for select
  to authenticated
  using (recipient_user_id = (select auth.uid()));
