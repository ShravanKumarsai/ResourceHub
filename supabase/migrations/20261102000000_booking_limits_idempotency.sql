begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.institutions
  add column if not exists max_active_reservations_per_user integer not null default 3
  check (max_active_reservations_per_user between 1 and 100);

create table if not exists public.operation_requests (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null check (length(btrim(operation_key)) between 16 and 200),
  operation_type text not null check (length(btrim(operation_type)) between 1 and 100),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  payload_hash bytea not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (actor_id, operation_type, operation_key)
);

create index if not exists operation_requests_created_idx
  on public.operation_requests (created_at desc);

alter table public.operation_requests enable row level security;
revoke all on public.operation_requests from public, anon, authenticated, service_role;

alter function public.request_resource_booking(uuid, timestamptz, timestamptz, text)
  rename to _request_resource_booking_legacy;
alter function public.review_resource_booking(uuid, text, text)
  rename to _review_resource_booking_legacy;
alter function public.cancel_resource_booking(uuid)
  rename to _cancel_resource_booking_legacy;
alter function public.record_booking_condition_report(uuid, text, text, text, text[])
  rename to _record_booking_condition_report_legacy;
alter function public.report_resource_incident(uuid, uuid, text, text, text)
  rename to _report_resource_incident_legacy;
alter function public.update_resource_incident(uuid, text, text)
  rename to _update_resource_incident_legacy;
alter function public.join_resource_waiting_list(uuid, timestamptz, timestamptz)
  rename to _join_resource_waiting_list_legacy;

revoke all on function public._request_resource_booking_legacy(uuid, timestamptz, timestamptz, text) from public, anon, authenticated, service_role;
revoke all on function public._review_resource_booking_legacy(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public._cancel_resource_booking_legacy(uuid) from public, anon, authenticated, service_role;
revoke all on function public._record_booking_condition_report_legacy(uuid, text, text, text, text[]) from public, anon, authenticated, service_role;
revoke all on function public._report_resource_incident_legacy(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public._update_resource_incident_legacy(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public._join_resource_waiting_list_legacy(uuid, timestamptz, timestamptz) from public, anon, authenticated, service_role;

create or replace function resourcehub_private.begin_operation(
  p_operation_key text,
  p_operation_type text,
  p_actor_id uuid,
  p_institution_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash bytea := extensions.digest(convert_to(p_payload::text, 'utf8'), 'sha256');
  v_existing public.operation_requests%rowtype;
begin
  if p_operation_key is null or length(btrim(p_operation_key)) < 16 then
    raise exception 'A valid idempotency key is required.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.operation_requests
  where actor_id = p_actor_id and operation_type = p_operation_type and operation_key = p_operation_key
  for update;

  if found then
    if v_existing.payload_hash <> v_hash then
      raise exception 'This idempotency key was already used with a different payload.' using errcode = '23505';
    end if;
    return jsonb_build_object('replayed', true, 'result', coalesce(v_existing.result, '{}'::jsonb));
  end if;

  insert into public.operation_requests (operation_key, operation_type, actor_id, institution_id, payload_hash)
  values (p_operation_key, p_operation_type, p_actor_id, p_institution_id, v_hash);
  return jsonb_build_object('replayed', false, 'result', '{}'::jsonb);
end;
$$;

create or replace function resourcehub_private.finish_operation(
  p_operation_key text,
  p_operation_type text,
  p_actor_id uuid,
  p_result jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.operation_requests
  set result = p_result, completed_at = now()
  where actor_id = p_actor_id and operation_type = p_operation_type and operation_key = p_operation_key;
$$;

revoke all on function resourcehub_private.begin_operation(text, text, uuid, uuid, jsonb) from public, anon, service_role;
revoke all on function resourcehub_private.finish_operation(text, text, uuid, jsonb) from public, anon, service_role;
grant execute on function resourcehub_private.begin_operation(text, text, uuid, uuid, jsonb) to authenticated;
grant execute on function resourcehub_private.finish_operation(text, text, uuid, jsonb) to authenticated;

create or replace function public.request_resource_booking(
  p_resource_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_purpose text, p_idempotency_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_resource public.resources%rowtype; v_result jsonb; v_booking_id uuid; v_count integer;
begin
  select * into v_resource from public.resources where id = p_resource_id and listed;
  if not found then raise exception 'Resource is unavailable.' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_resource.institution_id::text || ':' || v_actor::text, 0));
  v_result := resourcehub_private.begin_operation(p_idempotency_key, 'booking_request', v_actor, v_resource.institution_id,
    jsonb_build_object('resource_id', p_resource_id, 'starts_at', p_starts_at, 'ends_at', p_ends_at, 'purpose', p_purpose));
  if (v_result->>'replayed')::boolean then return (v_result->'result'->>'booking_id')::uuid; end if;
  select count(*) into v_count from public.bookings
  where institution_id = v_resource.institution_id and requester_user_id = v_actor
    and status in ('pending','approved','in_use')
    and (status = 'in_use' or ends_at > now());
  if v_count >= (select max_active_reservations_per_user from public.institutions where id = v_resource.institution_id) then
    raise exception 'Active reservation limit reached.' using errcode = '54000';
  end if;
  select public._request_resource_booking_legacy(p_resource_id, p_starts_at, p_ends_at, p_purpose) into v_booking_id;
  perform resourcehub_private.finish_operation(p_idempotency_key, 'booking_request', v_actor, jsonb_build_object('booking_id', v_booking_id));
  return v_booking_id;
end;
$$;

create or replace function public.review_resource_booking(p_booking_id uuid, p_decision text, p_note text, p_idempotency_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_booking public.bookings%rowtype; v_result jsonb;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  v_result := resourcehub_private.begin_operation(p_idempotency_key, 'booking_review', v_actor, v_booking.institution_id, jsonb_build_object('booking_id',p_booking_id,'decision',p_decision,'note',p_note));
  if (v_result->>'replayed')::boolean then return; end if;
  perform public._review_resource_booking_legacy(p_booking_id, p_decision, p_note);
  perform resourcehub_private.finish_operation(p_idempotency_key, 'booking_review', v_actor, '{}'::jsonb);
end; $$;

create or replace function public.cancel_resource_booking(p_booking_id uuid, p_idempotency_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_booking public.bookings%rowtype; v_result jsonb;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  v_result := resourcehub_private.begin_operation(p_idempotency_key, 'booking_cancel', v_actor, v_booking.institution_id, jsonb_build_object('booking_id',p_booking_id));
  if (v_result->>'replayed')::boolean then return; end if;
  perform public._cancel_resource_booking_legacy(p_booking_id);
  perform resourcehub_private.finish_operation(p_idempotency_key, 'booking_cancel', v_actor, '{}'::jsonb);
end; $$;

create or replace function public.record_booking_condition_report(p_booking_id uuid, p_phase text, p_rating text, p_notes text, p_checklist text[], p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_booking public.bookings%rowtype; v_result jsonb; v_report_id uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  v_result := resourcehub_private.begin_operation(p_idempotency_key, 'condition_report', v_actor, v_booking.institution_id, jsonb_build_object('booking_id',p_booking_id,'phase',p_phase,'rating',p_rating,'notes',p_notes,'checklist',p_checklist));
  if (v_result->>'replayed')::boolean then return (v_result->'result'->>'report_id')::uuid; end if;
  select public._record_booking_condition_report_legacy(p_booking_id,p_phase,p_rating,p_notes,p_checklist) into v_report_id;
  perform resourcehub_private.finish_operation(p_idempotency_key, 'condition_report', v_actor, jsonb_build_object('report_id',v_report_id));
  return v_report_id;
end; $$;

create or replace function public.report_resource_incident(p_resource_id uuid, p_booking_id uuid, p_severity text, p_title text, p_description text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_resource public.resources%rowtype; v_result jsonb; v_incident_id uuid;
begin
  select * into v_resource from public.resources where id = p_resource_id;
  if not found then raise exception 'Resource not found.' using errcode = 'P0002'; end if;
  v_result := resourcehub_private.begin_operation(p_idempotency_key, 'incident_report', v_actor, v_resource.institution_id, jsonb_build_object('resource_id',p_resource_id,'booking_id',p_booking_id,'severity',p_severity,'title',p_title,'description',p_description));
  if (v_result->>'replayed')::boolean then return (v_result->'result'->>'incident_id')::uuid; end if;
  select public._report_resource_incident_legacy(p_resource_id,p_booking_id,p_severity,p_title,p_description) into v_incident_id;
  perform resourcehub_private.finish_operation(p_idempotency_key, 'incident_report', v_actor, jsonb_build_object('incident_id',v_incident_id));
  return v_incident_id;
end; $$;

create or replace function public.update_resource_incident(p_incident_id uuid, p_status text, p_note text, p_idempotency_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_incident public.incidents%rowtype; v_result jsonb;
begin
  select * into v_incident from public.incidents where id = p_incident_id;
  if not found then raise exception 'Incident not found.' using errcode = 'P0002'; end if;
  v_result := resourcehub_private.begin_operation(p_idempotency_key, 'incident_update', v_actor, v_incident.institution_id, jsonb_build_object('incident_id',p_incident_id,'status',p_status,'note',p_note));
  if (v_result->>'replayed')::boolean then return; end if;
  perform public._update_resource_incident_legacy(p_incident_id,p_status,p_note);
  perform resourcehub_private.finish_operation(p_idempotency_key, 'incident_update', v_actor, '{}'::jsonb);
end; $$;

create or replace function public.join_resource_waiting_list(p_resource_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_resource public.resources%rowtype; v_result jsonb; v_entry_id uuid;
begin
  select * into v_resource from public.resources where id = p_resource_id;
  if not found then raise exception 'Resource unavailable.' using errcode = 'P0002'; end if;
  v_result := resourcehub_private.begin_operation(p_idempotency_key, 'waiting_list_join', v_actor, v_resource.institution_id, jsonb_build_object('resource_id',p_resource_id,'starts_at',p_starts_at,'ends_at',p_ends_at));
  if (v_result->>'replayed')::boolean then return (v_result->'result'->>'entry_id')::uuid; end if;
  select public._join_resource_waiting_list_legacy(p_resource_id,p_starts_at,p_ends_at) into v_entry_id;
  perform resourcehub_private.finish_operation(p_idempotency_key, 'waiting_list_join', v_actor, jsonb_build_object('entry_id',v_entry_id));
  return v_entry_id;
end; $$;

revoke all on public.operation_requests from public, anon, authenticated, service_role;
revoke all on function public.request_resource_booking(uuid,timestamptz,timestamptz,text) from public, anon, authenticated, service_role;
revoke all on function public.review_resource_booking(uuid,text,text) from public, anon, authenticated, service_role;
revoke all on function public.cancel_resource_booking(uuid) from public, anon, authenticated, service_role;
revoke all on function public.record_booking_condition_report(uuid,text,text,text,text[]) from public, anon, authenticated, service_role;
revoke all on function public.report_resource_incident(uuid,uuid,text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.update_resource_incident(uuid,text,text) from public, anon, authenticated, service_role;
revoke all on function public.join_resource_waiting_list(uuid,timestamptz,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.request_resource_booking(uuid,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.review_resource_booking(uuid,text,text,text) to authenticated;
grant execute on function public.cancel_resource_booking(uuid,text) to authenticated;
grant execute on function public.record_booking_condition_report(uuid,text,text,text,text[],text) to authenticated;
grant execute on function public.report_resource_incident(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.update_resource_incident(uuid,text,text,text) to authenticated;
grant execute on function public.join_resource_waiting_list(uuid,timestamptz,timestamptz,text) to authenticated;

commit;
