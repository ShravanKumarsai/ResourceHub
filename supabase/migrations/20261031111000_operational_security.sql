create or replace function resourcehub_private.has_active_resource_role(
  p_institution_id uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.institution_memberships as membership
    join public.institution_membership_roles as membership_role
      on membership_role.membership_id = membership.id
    join public.institutions as institution
      on institution.id = membership.institution_id
    where membership.institution_id = p_institution_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and institution.is_active
      and membership_role.role = p_role
  );
$$;

revoke all on function resourcehub_private.has_active_resource_role(uuid, text)
  from public, anon, service_role;
grant execute on function resourcehub_private.has_active_resource_role(uuid, text)
  to authenticated;

create or replace function resourcehub_private.set_resource_owner_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(nullif(btrim(profile.display_name), ''), 'Resource owner')
  into new.owner_name
  from public.profiles as profile
  where profile.id = new.owner_user_id;

  if new.owner_name is null then
    new.owner_name := 'Resource owner';
  end if;

  return new;
end;
$$;

revoke all on function resourcehub_private.set_resource_owner_name()
  from public, anon, authenticated, service_role;

create trigger resources_set_owner_name
before insert or update of owner_user_id on public.resources
for each row execute function resourcehub_private.set_resource_owner_name();

create or replace function resourcehub_private.record_resource_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_events (
    institution_id, actor_id, resource_id, event_type, summary
  )
  values (
    new.institution_id,
    auth.uid(),
    new.id,
    case when tg_op = 'INSERT' then 'resource_created' else 'resource_updated' end,
    case when tg_op = 'INSERT' then 'Resource listing created.' else 'Resource listing updated.' end
  );
  return new;
end;
$$;

revoke all on function resourcehub_private.record_resource_activity()
  from public, anon, authenticated, service_role;

create trigger resources_record_activity
after insert or update on public.resources
for each row execute function resourcehub_private.record_resource_activity();

alter table public.resources enable row level security;
alter table public.bookings enable row level security;
alter table public.condition_reports enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_events enable row level security;
alter table public.waiting_list_entries enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;

revoke all on public.resources, public.bookings, public.condition_reports,
  public.incidents, public.incident_events, public.waiting_list_entries,
  public.activity_events, public.notifications
from public, anon, authenticated, service_role;

grant select (
  id, institution_id, owner_name, name, category, location, description,
  image_path, specifications, highlights, availability, hourly_rate,
  max_duration_hours, approval_mode, eligibility, training, safety,
  use_cases, instructions, listed, created_at, updated_at
) on public.resources to anon;
grant select on public.resources to authenticated;
grant insert (
  institution_id, owner_membership_id, owner_user_id, name, category, location,
  description, image_path, specifications, highlights, availability,
  hourly_rate, max_duration_hours, approval_mode, eligibility, training,
  safety, use_cases, instructions, listed
) on public.resources to authenticated;
grant update (
  name, category, location, description, image_path, specifications,
  highlights, availability, hourly_rate, max_duration_hours, approval_mode,
  eligibility, training, safety, use_cases, instructions, listed
) on public.resources to authenticated;
grant delete on public.resources to authenticated;

grant select on public.bookings, public.condition_reports, public.incidents,
  public.incident_events, public.waiting_list_entries, public.activity_events,
  public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Anyone can read listed resources at active institutions"
on public.resources
for select to anon, authenticated
using (
  (listed and exists (
    select 1 from public.institutions as institution
    where institution.id = resources.institution_id and institution.is_active
  ))
);

create policy "Resource owners can read their own resources"
on public.resources
for select to authenticated
using (
  (
    owner_user_id = (select auth.uid())
    and resourcehub_private.has_active_resource_role(institution_id, 'resource_owner')
  )
);

create policy "Active resource owners can create their own resources"
on public.resources
for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and resourcehub_private.has_active_resource_role(institution_id, 'resource_owner')
  and exists (
    select 1 from public.institution_memberships as membership
    where membership.id = resources.owner_membership_id
      and membership.institution_id = resources.institution_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
  and exists (
    select 1 from public.institutions as institution
    where institution.id = resources.institution_id and institution.is_active
  )
);

create policy "Active resource owners can update their own resources"
on public.resources
for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and resourcehub_private.has_active_resource_role(institution_id, 'resource_owner')
)
with check (
  owner_user_id = (select auth.uid())
  and resourcehub_private.has_active_resource_role(institution_id, 'resource_owner')
);

create policy "Active resource owners can delete their own resources"
on public.resources
for delete to authenticated
using (
  owner_user_id = (select auth.uid())
  and resourcehub_private.has_active_resource_role(institution_id, 'resource_owner')
);

create policy "Booking participants and resource owners can read bookings"
on public.bookings
for select to authenticated
using (
  requester_user_id = (select auth.uid())
  or exists (
    select 1 from public.resources as resource
    where resource.id = bookings.resource_id
      and resource.owner_user_id = (select auth.uid())
      and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
  )
  or resourcehub_private.has_active_resource_role(institution_id, 'institution_admin')
);

create policy "Booking participants and resource owners can read condition reports"
on public.condition_reports
for select to authenticated
using (
  exists (
    select 1 from public.bookings as booking
    where booking.id = condition_reports.booking_id
      and (
        booking.requester_user_id = (select auth.uid())
        or exists (
          select 1 from public.resources as resource
          where resource.id = booking.resource_id
            and resource.owner_user_id = (select auth.uid())
            and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
        )
      )
  )
);

create policy "Incident reporters resource owners and admins can read incidents"
on public.incidents
for select to authenticated
using (
  reporter_user_id = (select auth.uid())
  or exists (
    select 1 from public.resources as resource
    where resource.id = incidents.resource_id
      and resource.owner_user_id = (select auth.uid())
      and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
  )
  or resourcehub_private.has_active_resource_role(institution_id, 'institution_admin')
);

create policy "Incident participants and admins can read incident history"
on public.incident_events
for select to authenticated
using (
  exists (
    select 1 from public.incidents as incident
    where incident.id = incident_events.incident_id
      and (
        incident.reporter_user_id = (select auth.uid())
        or resourcehub_private.has_active_resource_role(incident.institution_id, 'institution_admin')
        or exists (
          select 1 from public.resources as resource
          where resource.id = incident.resource_id
            and resource.owner_user_id = (select auth.uid())
            and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
        )
      )
  )
);

create policy "Waiting-list users and resource owners can read entries"
on public.waiting_list_entries
for select to authenticated
using (
  requester_user_id = (select auth.uid())
  or exists (
    select 1 from public.resources as resource
    where resource.id = waiting_list_entries.resource_id
      and resource.owner_user_id = (select auth.uid())
      and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
  )
);

create policy "Actors resource owners and admins can read activity"
on public.activity_events
for select to authenticated
using (
  actor_id = (select auth.uid())
  or resourcehub_private.has_active_resource_role(institution_id, 'institution_admin')
  or (
    resource_id is not null and exists (
      select 1 from public.resources as resource
      where resource.id = activity_events.resource_id
        and resource.owner_user_id = (select auth.uid())
        and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
    )
  )
);

create policy "Users can read their own notifications"
on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

create policy "Users can update their own notification read time"
on public.notifications
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create function public.request_resource_booking(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_purpose text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_resource public.resources%rowtype;
  v_membership_id uuid;
  v_booking_id uuid;
  v_status text;
  v_event_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at
    or p_starts_at <= now() or p_purpose is null
    or length(btrim(p_purpose)) < 15 or length(p_purpose) > 5000
  then raise exception 'Booking details are invalid.' using errcode = '22023'; end if;

  select * into v_resource from public.resources
  where id = p_resource_id and listed and availability <> 'unavailable';
  if not found then raise exception 'Resource is unavailable.' using errcode = 'P0002'; end if;
  if extract(epoch from (p_ends_at - p_starts_at)) / 3600 > v_resource.max_duration_hours
  then raise exception 'Requested duration exceeds this resource limit.' using errcode = '22023'; end if;

  select membership.id into v_membership_id
  from public.institution_memberships as membership
  join public.institution_membership_roles as membership_role
    on membership_role.membership_id = membership.id
  where membership.institution_id = v_resource.institution_id
    and membership.user_id = v_actor
    and membership.status = 'active'
    and membership_role.role = 'student'
  limit 1;
  if v_membership_id is null then raise exception 'Active student membership required.' using errcode = '42501'; end if;

  v_status := case when v_resource.approval_mode = 'automatic' then 'approved' else 'pending' end;
  insert into public.bookings (
    institution_id, resource_id, requester_membership_id, requester_user_id,
    starts_at, ends_at, purpose, status, reviewed_at, reviewed_by
  )
  values (
    v_resource.institution_id, v_resource.id, v_membership_id, v_actor,
    p_starts_at, p_ends_at, btrim(p_purpose), v_status,
    case when v_status = 'approved' then now() else null end,
    case when v_status = 'approved' then v_actor else null end
  )
  returning id into v_booking_id;

  insert into public.activity_events (institution_id, actor_id, resource_id, booking_id, event_type, summary)
  values (v_resource.institution_id, v_actor, v_resource.id, v_booking_id, 'booking_requested', 'A booking was requested.')
  returning id into v_event_id;

  if v_status = 'pending' then
    insert into public.notifications (recipient_id, institution_id, activity_event_id, title, body)
    values (v_resource.owner_user_id, v_resource.institution_id, v_event_id, 'Booking request', 'A resource booking is awaiting review.');
  else
    insert into public.notifications (recipient_id, institution_id, activity_event_id, title, body)
    values (v_actor, v_resource.institution_id, v_event_id, 'Booking confirmed', 'Your booking was automatically confirmed.');
  end if;
  return v_booking_id;
end;
$$;

create function public.review_resource_booking(
  p_booking_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_resource public.resources%rowtype;
  v_event_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected')
    or (p_note is not null and length(p_note) > 2000)
  then raise exception 'Review details are invalid.' using errcode = '22023'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.status <> 'pending'
  then raise exception 'Only pending bookings can be reviewed.' using errcode = '55000'; end if;
  select * into v_resource from public.resources where id = v_booking.resource_id;
  if v_resource.owner_user_id <> v_actor
    or not resourcehub_private.has_active_resource_role(v_resource.institution_id, 'resource_owner')
  then raise exception 'Active resource owner authorization required.' using errcode = '42501'; end if;

  update public.bookings set status = p_decision, decision_note = nullif(btrim(p_note), ''),
    reviewed_by = v_actor, reviewed_at = now()
  where id = v_booking.id;
  insert into public.activity_events (institution_id, actor_id, resource_id, booking_id, event_type, summary)
  values (v_booking.institution_id, v_actor, v_booking.resource_id, v_booking.id,
    case when p_decision = 'approved' then 'booking_approved' else 'booking_rejected' end,
    case when p_decision = 'approved' then 'A booking was approved.' else 'A booking was rejected.' end)
  returning id into v_event_id;
  insert into public.notifications (recipient_id, institution_id, activity_event_id, title, body)
  values (v_booking.requester_user_id, v_booking.institution_id, v_event_id,
    case when p_decision = 'approved' then 'Booking approved' else 'Booking declined' end,
    case when p_decision = 'approved' then 'Your booking was approved.' else 'Your booking was declined.' end);
end;
$$;

create function public.cancel_resource_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_event_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.requester_user_id <> v_actor
    or v_booking.status not in ('pending', 'approved') or v_booking.starts_at <= now()
  then raise exception 'This booking cannot be cancelled by the caller.' using errcode = '42501'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
  insert into public.activity_events (institution_id, actor_id, resource_id, booking_id, event_type, summary)
  values (v_booking.institution_id, v_actor, v_booking.resource_id, v_booking.id, 'booking_cancelled', 'A booking was cancelled.')
  returning id into v_event_id;
  insert into public.notifications (recipient_id, institution_id, activity_event_id, title, body)
  select resource.owner_user_id, v_booking.institution_id, v_event_id, 'Booking cancelled', 'A booking for your resource was cancelled.'
  from public.resources as resource where resource.id = v_booking.resource_id;
end;
$$;

create function public.record_booking_condition_report(
  p_booking_id uuid,
  p_phase text,
  p_rating text,
  p_notes text,
  p_checklist text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_resource public.resources%rowtype;
  v_report_id uuid;
  v_next_status text;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_phase not in ('check_out', 'check_in')
    or p_rating not in ('excellent', 'good', 'minor_wear', 'damaged')
    or p_notes is null or length(p_notes) > 2000
    or p_checklist is null or cardinality(p_checklist) = 0
    or (p_rating = 'damaged' and length(btrim(p_notes)) < 10)
  then raise exception 'Condition report is invalid.' using errcode = '22023'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  select * into v_resource from public.resources where id = v_booking.resource_id;
  if v_actor <> v_booking.requester_user_id and v_actor <> v_resource.owner_user_id
  then raise exception 'Booking participant authorization required.' using errcode = '42501'; end if;
  if v_actor = v_booking.requester_user_id
    and not resourcehub_private.has_active_resource_role(v_booking.institution_id, 'student')
  then raise exception 'Active student membership required.' using errcode = '42501'; end if;
  if v_actor = v_resource.owner_user_id
    and not resourcehub_private.has_active_resource_role(v_resource.institution_id, 'resource_owner')
  then raise exception 'Active resource owner membership required.' using errcode = '42501'; end if;

  if p_phase = 'check_out' and (v_booking.status <> 'approved' or v_booking.starts_at > now())
  then raise exception 'Only a due approved booking can be checked out.' using errcode = '55000'; end if;
  if p_phase = 'check_in' and v_booking.status <> 'in_use'
  then raise exception 'Only an in-use booking can be checked in.' using errcode = '55000'; end if;

  insert into public.condition_reports (booking_id, phase, rating, notes, checklist, recorded_by)
  values (p_booking_id, p_phase, p_rating, btrim(p_notes), p_checklist, v_actor)
  returning id into v_report_id;
  v_next_status := case when p_phase = 'check_out' then 'in_use' else 'completed' end;
  update public.bookings set status = v_next_status where id = p_booking_id;
  insert into public.activity_events (institution_id, actor_id, resource_id, booking_id, event_type, summary)
  values (v_booking.institution_id, v_actor, v_booking.resource_id, p_booking_id, p_phase, 'A booking condition report was recorded.');
  return v_report_id;
end;
$$;

create function public.report_resource_incident(
  p_resource_id uuid,
  p_booking_id uuid,
  p_severity text,
  p_title text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_resource public.resources%rowtype;
  v_membership_id uuid;
  v_incident_id uuid;
  v_event_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_severity not in ('low', 'medium', 'high', 'critical')
    or p_title is null or length(btrim(p_title)) not between 3 and 200
    or p_description is null or length(btrim(p_description)) not between 10 and 10000
  then raise exception 'Incident details are invalid.' using errcode = '22023'; end if;

  select * into v_resource from public.resources where id = p_resource_id;
  if not found then raise exception 'Resource not found.' using errcode = 'P0002'; end if;
  select membership.id into v_membership_id
  from public.institution_memberships as membership
  where membership.institution_id = v_resource.institution_id
    and membership.user_id = v_actor and membership.status = 'active'
    and (
      (v_resource.owner_user_id = v_actor and resourcehub_private.has_active_resource_role(v_resource.institution_id, 'resource_owner'))
      or (p_booking_id is not null and exists (
        select 1 from public.bookings as booking
        where booking.id = p_booking_id and booking.resource_id = p_resource_id
          and booking.requester_user_id = v_actor
      ) and resourcehub_private.has_active_resource_role(v_resource.institution_id, 'student'))
    )
  limit 1;
  if v_membership_id is null then raise exception 'Authorized resource participant required.' using errcode = '42501'; end if;

  insert into public.incidents (
    institution_id, resource_id, booking_id, reporter_membership_id, reporter_user_id,
    severity, title, description
  )
  values (v_resource.institution_id, v_resource.id, p_booking_id, v_membership_id, v_actor,
    p_severity, btrim(p_title), btrim(p_description))
  returning id into v_incident_id;
  insert into public.incident_events (incident_id, institution_id, actor_id, to_status, note)
  values (v_incident_id, v_resource.institution_id, v_actor, 'open', 'Incident reported.');
  insert into public.activity_events (institution_id, actor_id, resource_id, incident_id, event_type, summary)
  values (v_resource.institution_id, v_actor, v_resource.id, v_incident_id, 'incident_reported', 'An incident was reported.')
  returning id into v_event_id;
  insert into public.notifications (recipient_id, institution_id, activity_event_id, title, body)
  values (v_resource.owner_user_id, v_resource.institution_id, v_event_id, 'Incident reported', 'An incident was reported for your resource.');
  return v_incident_id;
end;
$$;

create function public.update_resource_incident(
  p_incident_id uuid,
  p_status text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_incident public.incidents%rowtype;
  v_resource public.resources%rowtype;
  v_event_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_status not in ('open', 'investigating', 'resolved')
    or p_note is null or length(p_note) > 2000
  then raise exception 'Incident update is invalid.' using errcode = '22023'; end if;
  select * into v_incident from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'Incident not found.' using errcode = 'P0002'; end if;
  select * into v_resource from public.resources where id = v_incident.resource_id;
  if v_resource.owner_user_id <> v_actor
    or not resourcehub_private.has_active_resource_role(v_resource.institution_id, 'resource_owner')
  then raise exception 'Active resource owner authorization required.' using errcode = '42501'; end if;
  update public.incidents set status = p_status where id = v_incident.id;
  insert into public.incident_events (incident_id, institution_id, actor_id, from_status, to_status, note)
  values (v_incident.id, v_incident.institution_id, v_actor, v_incident.status, p_status, btrim(p_note));
  insert into public.activity_events (institution_id, actor_id, resource_id, incident_id, event_type, summary)
  values (v_incident.institution_id, v_actor, v_incident.resource_id, v_incident.id, 'incident_updated', 'An incident status was updated.')
  returning id into v_event_id;
  insert into public.notifications (recipient_id, institution_id, activity_event_id, title, body)
  values (v_incident.reporter_user_id, v_incident.institution_id, v_event_id, 'Incident updated', 'Your incident report status was updated.');
end;
$$;

create function public.join_resource_waiting_list(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_resource public.resources%rowtype;
  v_membership_id uuid;
  v_entry_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at or p_starts_at <= now()
  then raise exception 'Waiting-list time range is invalid.' using errcode = '22023'; end if;
  select * into v_resource from public.resources where id = p_resource_id and listed;
  if not found then raise exception 'Resource is unavailable.' using errcode = 'P0002'; end if;
  select membership.id into v_membership_id
  from public.institution_memberships as membership
  join public.institution_membership_roles as membership_role
    on membership_role.membership_id = membership.id
  where membership.institution_id = v_resource.institution_id
    and membership.user_id = v_actor and membership.status = 'active'
    and membership_role.role = 'student'
  limit 1;
  if v_membership_id is null then raise exception 'Active student membership required.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.bookings as booking
    where booking.resource_id = v_resource.id
      and booking.status in ('approved', 'in_use')
      and tstzrange(booking.starts_at, booking.ends_at, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then raise exception 'The requested time is not blocked by a confirmed booking.' using errcode = '22023'; end if;
  insert into public.waiting_list_entries (
    institution_id, resource_id, requester_membership_id, requester_user_id, starts_at, ends_at
  )
  values (v_resource.institution_id, v_resource.id, v_membership_id, v_actor, p_starts_at, p_ends_at)
  returning id into v_entry_id;
  insert into public.activity_events (institution_id, actor_id, resource_id, event_type, summary)
  values (v_resource.institution_id, v_actor, v_resource.id, 'waiting_list_joined', 'A user joined a resource waiting list.');
  return v_entry_id;
end;
$$;

revoke all on function public.request_resource_booking(uuid, timestamptz, timestamptz, text)
  from public, anon, service_role;
revoke all on function public.review_resource_booking(uuid, text, text)
  from public, anon, service_role;
revoke all on function public.cancel_resource_booking(uuid)
  from public, anon, service_role;
revoke all on function public.record_booking_condition_report(uuid, text, text, text, text[])
  from public, anon, service_role;
revoke all on function public.report_resource_incident(uuid, uuid, text, text, text)
  from public, anon, service_role;
revoke all on function public.update_resource_incident(uuid, text, text)
  from public, anon, service_role;
revoke all on function public.join_resource_waiting_list(uuid, timestamptz, timestamptz)
  from public, anon, service_role;

grant execute on function public.request_resource_booking(uuid, timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.review_resource_booking(uuid, text, text)
  to authenticated;
grant execute on function public.cancel_resource_booking(uuid)
  to authenticated;
grant execute on function public.record_booking_condition_report(uuid, text, text, text, text[])
  to authenticated;
grant execute on function public.report_resource_incident(uuid, uuid, text, text, text)
  to authenticated;
grant execute on function public.update_resource_incident(uuid, text, text)
  to authenticated;
grant execute on function public.join_resource_waiting_list(uuid, timestamptz, timestamptz)
  to authenticated;
