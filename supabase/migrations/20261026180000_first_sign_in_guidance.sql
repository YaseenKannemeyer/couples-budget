-- Extend the existing owner-only progress contract. No progress is reset.
alter table public.guide_progress drop constraint guide_progress_check;
alter table public.guide_progress add constraint guide_progress_check check (case guide_id
  when 'welcome' then step_id in ('spaces','connect')
  when 'first-visit' then step_id in ('home','shared','private','log')
  when 'quick-log' then step_id in ('space','save')
  when 'payments' then step_id in ('list','create')
  when 'cashflow' then step_id in ('forecast','calendar')
  when 'categories' then step_id in ('spaces','create')
  when 'budget-categories' then step_id in ('plan','assign')
  when 'private-allowance' then step_id in ('balance','privacy')
  else false end);
