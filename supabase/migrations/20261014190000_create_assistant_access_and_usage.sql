-- Help assistant access flag and usage window (Feature #499, WU2).
--
-- Two pieces back the assistant's access controls:
--
--   * `public.profile.chat_enabled` is the per-user access flag (owner decision
--     D9, off by default). The API enforces it; the admin console toggles it.
--     It is a column on the existing `profile`, so the existing RLS policies and
--     grants are unchanged: only the owner's own row carries it, and no role has
--     an UPDATE grant on `profile` from the browser.
--
--   * `public.assistant_question` records one timestamp per accepted question,
--     for the rolling-window cap (owner decision D6: 5 per user per 24h). Only
--     the timestamp is stored — never the question or answer text (D5).
--
-- Access: RLS is enabled with NO policy and no browser grant. The API serves the
-- assistant as `service_role`, which bypasses RLS; neither `anon` nor
-- `authenticated` touches this table directly. Grants are set in the same
-- migration so no default anon/authenticated grant ever survives even
-- transiently.
--
-- Migration workflow: verified against the local stack first (`pnpm run test:db`)
-- and applied to the remote Supabase project afterwards, in the same work unit,
-- once the local suite is green.
--
-- Reversal (no data outside this feature depends on it):
--   drop table if exists public.assistant_question;
--   alter table public.profile drop column if exists chat_enabled;

alter table public.profile
  add column chat_enabled boolean not null default false;

create table public.assistant_question (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references public.profile(user_id) on delete cascade,
  asked_at timestamptz not null default now()
);

-- The rolling-window count (5 per user per 24h, D6): filter by user and an
-- `asked_at` lower bound, newest first.
create index assistant_question_user_window_idx
  on public.assistant_question (user_id, asked_at desc);

alter table public.assistant_question enable row level security;

revoke all on public.assistant_question from anon, authenticated, service_role;

-- The API is the only writer and reader: it counts the window and records each
-- accepted question. It connects as service_role.
grant select, insert on public.assistant_question to service_role;
