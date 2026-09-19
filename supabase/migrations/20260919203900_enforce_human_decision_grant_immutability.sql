-- Supabase grants service_role broad privileges on new tables by default, so
-- revoking from anon/authenticated alone left the audit table mutable through
-- the service role. Keep only what the decision RPC and audit reads need.
-- Parent cleanup still works: ON DELETE CASCADE runs as the table owner.
revoke all on public.human_decision from service_role;
grant select, insert on public.human_decision to service_role;
