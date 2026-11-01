create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null check (length(endpoint) between 1 and 2048),
  p256dh text not null check (length(p256dh) between 80 and 160),
  auth text not null check (length(auth) between 16 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index notification_push_subscriptions_user_idx
  on public.notification_push_subscriptions (user_id);

create table public.notification_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text check (last_error is null or length(last_error) <= 120),
  provider_message_id text check (
    provider_message_id is null or length(provider_message_id) <= 256
  ),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (notification_id, channel)
);

create index notification_delivery_jobs_due_idx
  on public.notification_delivery_jobs (status, next_attempt_at, created_at);

create table resourcehub_private.notification_scheduled_events (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null check (event_type in (
    'booking_start_reminder',
    'booking_return_reminder',
    'booking_overdue',
    'booking_overdue_owner'
  )),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (booking_id, event_type, recipient_id)
);

revoke all on resourcehub_private.notification_scheduled_events
  from public, anon, authenticated, service_role;

alter table public.notification_preferences enable row level security;
alter table public.notification_push_subscriptions enable row level security;
alter table public.notification_delivery_jobs enable row level security;

revoke all on public.notification_preferences,
  public.notification_push_subscriptions,
  public.notification_delivery_jobs
from public, anon, authenticated, service_role;

grant select on public.notification_preferences to authenticated;
grant all on public.notification_preferences,
  public.notification_push_subscriptions,
  public.notification_delivery_jobs
to service_role;

create policy "Users can read their own notification preferences"
on public.notification_preferences
for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read their own push subscriptions"
on public.notification_push_subscriptions
for select to authenticated
using (user_id = (select auth.uid()));

create or replace function resourcehub_private.enqueue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_delivery_jobs (
    notification_id,
    recipient_id,
    channel
  )
  select
    new.id,
    preference.user_id,
    delivery.channel
  from public.notification_preferences as preference
  cross join lateral (
    values
      ('email'::text, preference.email_enabled),
      ('push'::text, preference.push_enabled)
  ) as delivery(channel, enabled)
  where preference.user_id = new.recipient_id
    and delivery.enabled
  on conflict (notification_id, channel) do nothing;

  return new;
end;
$$;

revoke all on function resourcehub_private.enqueue_notification_delivery()
  from public, anon, authenticated, service_role;

create trigger notifications_enqueue_delivery
after insert on public.notifications
for each row execute function resourcehub_private.enqueue_notification_delivery();

create or replace function resourcehub_private.notify_waiting_list_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'offered' and old.status is distinct from new.status then
    insert into public.notifications (
      recipient_id, institution_id, title, body
    )
    values (
      new.requester_user_id,
      new.institution_id,
      'Waiting-list offer',
      'A time slot is available. Review your waiting list for details.'
    );
  end if;

  return new;
end;
$$;

revoke all on function resourcehub_private.notify_waiting_list_offer()
  from public, anon, authenticated, service_role;

create trigger waiting_list_entries_notify_offer
after update of status on public.waiting_list_entries
for each row execute function resourcehub_private.notify_waiting_list_offer();

create or replace function public.queue_scheduled_booking_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer;
begin
  with due as (
    select
      booking.id as booking_id,
      'booking_start_reminder'::text as event_type,
      booking.requester_user_id as recipient_id,
      booking.institution_id,
      'Booking starts soon'::text as title,
      'Your approved resource booking starts within 24 hours.'::text as body
    from public.bookings as booking
    join public.institutions as institution
      on institution.id = booking.institution_id
      and institution.is_active
    join public.resources as resource
      on resource.id = booking.resource_id
      and resource.archived_at is null
    where booking.status = 'approved'
      and booking.starts_at > pg_catalog.clock_timestamp()
      and booking.starts_at <= pg_catalog.clock_timestamp() + interval '24 hours'

    union all

    select
      booking.id,
      'booking_return_reminder'::text,
      booking.requester_user_id,
      booking.institution_id,
      'Booking ends soon'::text,
      'Your in-use resource booking is due to end within one hour.'::text
    from public.bookings as booking
    join public.institutions as institution
      on institution.id = booking.institution_id
      and institution.is_active
    join public.resources as resource
      on resource.id = booking.resource_id
      and resource.archived_at is null
    where booking.status = 'in_use'
      and booking.ends_at > pg_catalog.clock_timestamp()
      and booking.ends_at <= pg_catalog.clock_timestamp() + interval '1 hour'

    union all

    select
      booking.id,
      'booking_overdue'::text,
      booking.requester_user_id,
      booking.institution_id,
      'Resource return overdue'::text,
      'Your in-use resource booking has passed its scheduled end time.'::text
    from public.bookings as booking
    join public.institutions as institution
      on institution.id = booking.institution_id
      and institution.is_active
    join public.resources as resource
      on resource.id = booking.resource_id
      and resource.archived_at is null
    where booking.status = 'in_use'
      and booking.ends_at <= pg_catalog.clock_timestamp()

    union all

    select
      booking.id,
      'booking_overdue_owner'::text,
      resource.owner_user_id,
      booking.institution_id,
      'Resource return overdue'::text,
      'An in-use resource booking has passed its scheduled end time.'::text
    from public.bookings as booking
    join public.institutions as institution
      on institution.id = booking.institution_id
      and institution.is_active
    join public.resources as resource
      on resource.id = booking.resource_id
      and resource.archived_at is null
    where booking.status = 'in_use'
      and booking.ends_at <= pg_catalog.clock_timestamp()
  ),
  queued as (
    insert into resourcehub_private.notification_scheduled_events (
      booking_id, event_type, recipient_id, institution_id
    )
    select distinct
      due.booking_id,
      due.event_type,
      due.recipient_id,
      due.institution_id
    from due
    on conflict (booking_id, event_type, recipient_id) do nothing
    returning booking_id, event_type, recipient_id, institution_id
  )
  insert into public.notifications (
    recipient_id, institution_id, title, body
  )
  select
    queued.recipient_id,
    queued.institution_id,
    due.title,
    due.body
  from queued
  join due
    on due.booking_id = queued.booking_id
    and due.event_type = queued.event_type
    and due.recipient_id = queued.recipient_id
    and due.institution_id = queued.institution_id;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

create or replace function public.upsert_notification_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_host text;
  v_subscription_id uuid;
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_endpoint is null
    or length(p_endpoint) > 2048
    or p_endpoint !~ '^https://[A-Za-z0-9.-]+/[^[:space:]#]*$'
    or p_p256dh is null
    or p_p256dh !~ '^[A-Za-z0-9_-]{80,160}$'
    or p_auth is null
    or p_auth !~ '^[A-Za-z0-9_-]{16,64}$'
  then
    raise exception using errcode = '22023', message = 'invalid_push_subscription';
  end if;

  v_host := pg_catalog.lower(pg_catalog.split_part(pg_catalog.split_part(p_endpoint, '/', 3), ':', 1));

  if v_host not in ('fcm.googleapis.com', 'push.services.mozilla.com', 'web.push.apple.com')
    and v_host !~ '(^|[.])notify[.]windows[.]com$'
    and v_host !~ '(^|[.])push[.]services[.]mozilla[.]com$'
  then
    raise exception using errcode = '22023', message = 'unsupported_push_endpoint';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 7351)
  );

  select subscription.id
  into v_subscription_id
  from public.notification_push_subscriptions as subscription
  where subscription.user_id = v_user_id
    and subscription.endpoint = p_endpoint;

  if v_subscription_id is not null then
    update public.notification_push_subscriptions
    set p256dh = p_p256dh,
        auth = p_auth,
        updated_at = pg_catalog.now()
    where id = v_subscription_id;
    return v_subscription_id;
  end if;

  select pg_catalog.count(*)::integer
  into v_count
  from public.notification_push_subscriptions as subscription
  where subscription.user_id = v_user_id;

  if v_count >= 5 then
    raise exception using errcode = '54000', message = 'push_subscription_limit_reached';
  end if;

  insert into public.notification_push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth
  )
  values (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth
  )
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

create or replace function public.delete_notification_push_subscription(
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_endpoint is null or length(p_endpoint) > 2048 then
    raise exception using errcode = '22023', message = 'invalid_push_subscription';
  end if;

  delete from public.notification_push_subscriptions as subscription
  where subscription.user_id = v_user_id
    and subscription.endpoint = p_endpoint;

  return found;
end;
$$;

revoke all on function public.upsert_notification_push_subscription(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_notification_push_subscription(text)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_notification_push_subscription(text, text, text)
  to authenticated;
grant execute on function public.delete_notification_push_subscription(text)
  to authenticated;

create or replace function public.claim_notification_delivery_jobs(
  p_channels text[],
  p_limit integer
)
returns table (
  id uuid,
  notification_id uuid,
  recipient_id uuid,
  channel text,
  title text,
  body text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_channels is null
    or pg_catalog.cardinality(p_channels) < 1
    or pg_catalog.cardinality(p_channels) > 2
    or p_channels <@ array['email', 'push']::text[] is not true
  then
    raise exception using errcode = '22023', message = 'invalid_delivery_channels';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception using errcode = '22023', message = 'batch_limit_out_of_range';
  end if;

  update public.notification_delivery_jobs as job
  set status = 'failed',
      locked_until = null,
      last_error = 'retry_limit_reached'
  where job.status = 'processing'
    and job.attempts >= 5
    and job.locked_until <= pg_catalog.clock_timestamp();

  update public.notification_delivery_jobs as job
  set status = 'skipped',
      locked_until = null,
      last_error = 'preference_disabled'
  where job.status = 'pending'
    and not exists (
      select 1
      from public.notification_preferences as preference
      where preference.user_id = job.recipient_id
        and case job.channel
          when 'email' then preference.email_enabled
          when 'push' then preference.push_enabled
          else false
        end
    );

  return query
  with candidates as (
    select job.id
    from public.notification_delivery_jobs as job
    where job.channel = any(p_channels)
      and job.attempts < 5
      and (
        (job.status = 'pending' and job.next_attempt_at <= pg_catalog.clock_timestamp())
        or (
          job.status = 'processing'
          and job.locked_until <= pg_catalog.clock_timestamp()
        )
      )
      and exists (
        select 1
        from public.notification_preferences as preference
        where preference.user_id = job.recipient_id
          and case job.channel
            when 'email' then preference.email_enabled
            when 'push' then preference.push_enabled
            else false
          end
      )
    order by job.created_at, job.id
    for update of job skip locked
    limit p_limit
  ),
  claimed as (
    update public.notification_delivery_jobs as job
    set status = 'processing',
        attempts = job.attempts + 1,
        locked_until = pg_catalog.clock_timestamp() + interval '2 minutes',
        last_error = null
    from candidates
    where job.id = candidates.id
    returning job.id, job.notification_id, job.recipient_id, job.channel
  )
  select
    claimed.id,
    claimed.notification_id,
    claimed.recipient_id,
    claimed.channel,
    notification.title,
    notification.body
  from claimed
  join public.notifications as notification
    on notification.id = claimed.notification_id;
end;
$$;

create or replace function public.finish_notification_delivery_job(
  p_id uuid,
  p_outcome text,
  p_error_code text default null,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.notification_delivery_jobs%rowtype;
begin
  if p_outcome is null or p_outcome not in ('sent', 'retry', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid_delivery_outcome';
  end if;

  select job.*
  into v_job
  from public.notification_delivery_jobs as job
  where job.id = p_id
    and job.status = 'processing'
  for update;

  if not found then
    return false;
  end if;

  if p_outcome = 'sent' then
    update public.notification_delivery_jobs
    set status = 'sent',
        delivered_at = pg_catalog.clock_timestamp(),
        locked_until = null,
        last_error = null,
        provider_message_id = left(p_provider_message_id, 256)
    where id = p_id;
  elsif p_outcome = 'skipped' then
    update public.notification_delivery_jobs
    set status = 'skipped',
        locked_until = null,
        last_error = left(coalesce(nullif(btrim(p_error_code), ''), 'delivery_skipped'), 120)
    where id = p_id;
  elsif v_job.attempts >= 5 then
    update public.notification_delivery_jobs
    set status = 'failed',
        locked_until = null,
        last_error = left(coalesce(nullif(btrim(p_error_code), ''), 'provider_error'), 120)
    where id = p_id;
  else
    update public.notification_delivery_jobs
    set status = 'pending',
        next_attempt_at = pg_catalog.clock_timestamp()
      + least(60, pg_catalog.power(2, v_job.attempts)::integer) * interval '1 minute',
        locked_until = null,
        last_error = left(coalesce(nullif(btrim(p_error_code), ''), 'provider_error'), 120)
    where id = p_id;
  end if;

  return true;
end;
$$;

revoke all on function public.claim_notification_delivery_jobs(text[], integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_notification_delivery_job(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.queue_scheduled_booking_notifications()
  from public, anon, authenticated, service_role;
grant execute on function public.queue_scheduled_booking_notifications()
  to service_role;
grant execute on function public.claim_notification_delivery_jobs(text[], integer)
  to service_role;
grant execute on function public.finish_notification_delivery_job(uuid, text, text, text)
  to service_role;
