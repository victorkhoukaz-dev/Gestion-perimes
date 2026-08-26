-- Invoke the alert function hourly. The function itself sends only at 08:00
-- America/Toronto and only for pharmacies whose owner enabled the setting.
-- The secret is retrieved from Vault at run time; it is never stored in Git.

begin;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'current-month-expiry-alerts-hourly';

select cron.schedule(
  'current-month-expiry-alerts-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://hhmwlzaeipyrowwjlbbj.supabase.co/functions/v1/current-month-expiry-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alert-job-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'email_alert_job_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

commit;
