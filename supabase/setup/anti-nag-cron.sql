-- Run AFTER deploying anti-nag and configuring its matching NUDGE_CRON_SECRET.
-- Create Vault secrets named anti_nag_project_url and anti_nag_cron_secret in
-- the dashboard. Never put a service-role key or secret in app/public env vars.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='anti_nag_project_url')
 or not exists(select 1 from vault.decrypted_secrets where name='anti_nag_cron_secret') then raise exception 'Configure anti-nag Vault secrets first';end if;
end $$;
select cron.schedule('couple-goals-anti-nag','*/5 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='anti_nag_project_url')||'/functions/v1/anti-nag',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='anti_nag_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=120000);
$job$);
