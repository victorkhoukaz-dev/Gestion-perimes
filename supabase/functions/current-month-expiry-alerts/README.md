# Current-month expiry email alerts

This function sends one email per owner/admin, per pharmacy, per local day when
active flagged products have an expiry date in the current month. It only runs
for pharmacies whose owner has enabled the setting in the app.

## Required secrets

Set these Edge Function secrets before deploying the function:

- `RESEND_API_KEY` — API key from the email provider.
- `EMAIL_FROM` — verified sender, for example `PharmaOps <alerts@example.com>`.
- `ALERT_JOB_SECRET` — a long random value used only by the scheduled job.
- `APP_URL` — optional link to the production PharmaOps application.

Do not put any of these values in source control or in the browser application.

## Schedule

The function checks the pharmacy timezone and sends only at 08:00 local time.
After the function is deployed, create two Vault secrets with the production
function URL and the same `ALERT_JOB_SECRET` value, then schedule this hourly
job in Supabase Cron:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'current_month_alert_function_url'
);

select vault.create_secret(
  'THE_SAME_ALERT_JOB_SECRET',
  'current_month_alert_job_secret'
);

select cron.schedule(
  'current-month-expiry-alerts-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'current_month_alert_function_url') || '/functions/v1/current-month-expiry-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alert-job-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'current_month_alert_job_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The `email_alert_deliveries` table prevents the hourly job from sending a
duplicate email to the same recipient on the same local day.
