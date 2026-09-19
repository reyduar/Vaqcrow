-- Preserve direct audit immutability while allowing synthetic parent cleanup to
-- remove its dependent human decisions through the application lifecycle.
alter table public.human_decision
  drop constraint human_decision_application_id_fkey,
  add constraint human_decision_application_id_fkey
    foreign key (application_id)
    references public.application_review(application_id)
    on delete cascade;
