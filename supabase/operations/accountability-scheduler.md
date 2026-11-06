# Accountability notification scheduler

The application code supports processing overdue handovers through
`process_overdue_handover_flags`. The existing Vercel Hobby cron cannot run
every five minutes, so minute-level detection and delivery must be driven by
Supabase `pg_cron` and `pg_net`.

## Configure the Supabase project

1. Deploy the application with `CRON_SECRET` set to a long, random secret.
   Keep the same value configured in the Supabase Vault; never put it in this
   repository or a client-side environment variable.
2. In the Supabase SQL Editor, enable `pg_cron`, `pg_net`, and Vault if they
   are not already enabled for the project.
3. Store the production HTTPS worker URL and the matching cron secret in Vault:

   ```sql
   select vault.create_secret(
     'https://YOUR_PRODUCTION_HOST/api/cron/notifications',
     'resourcehub_notification_worker_url'
   );

   select vault.create_secret(
     'YOUR_CRON_SECRET',
     'resourcehub_notification_worker_secret'
   );
   ```

4. Schedule a minute-level worker invocation:

   ```sql
   select cron.schedule(
     'resourcehub-accountability-notifications',
     '* * * * *',
     $job$
       select net.http_post(
         url := (
           select decrypted_secret
           from vault.decrypted_secrets
           where name = 'resourcehub_notification_worker_url'
         ),
         headers := jsonb_build_object(
           'Authorization',
           'Bearer ' || (
             select decrypted_secret
             from vault.decrypted_secrets
             where name = 'resourcehub_notification_worker_secret'
           ),
           'Content-Type',
           'application/json'
         ),
         body := '{}'::jsonb,
         timeout_milliseconds := 10000
       );
     $job$
   );
   ```

Use the production domain only. The worker authenticates each invocation with
`CRON_SECRET`, processes overdue handovers before notification delivery, and
uses database uniqueness constraints to make retries safe. A later minute
invocation retries pending work after temporary failures. The daily Vercel cron
is only a fallback for notification delivery; it is not the deadline detector.

To confirm or remove the Supabase schedule:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'resourcehub-accountability-notifications';

select cron.unschedule(jobid)
from cron.job
where jobname = 'resourcehub-accountability-notifications';
```

Check `net._http_response` and the Vercel function logs when diagnosing failed
requests. Do not remove the Vault secrets or `CRON_SECRET` until the job has
been unscheduled.

## Evidence and incident retries

The accountability migration creates private handover and incident evidence
buckets with membership- and resource-scoped storage policies. Manager views
receive short-lived signed URLs; do not make either bucket public. Incident
submissions use an idempotency key so a retry returns the original incident
instead of creating duplicate incident records or notifications.
