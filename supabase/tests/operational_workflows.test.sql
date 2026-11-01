begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000009601', 'authenticated', 'authenticated',
    'operational-student-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009602', 'authenticated', 'authenticated',
    'operational-manager-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009603', 'authenticated', 'authenticated',
    'operational-manager-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009604', 'authenticated', 'authenticated',
    'operational-outsider@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009605', 'authenticated', 'authenticated',
    'operational-student-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009606', 'authenticated', 'authenticated',
    'operational-admin-a@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.institutions (id, name, slug)
values
  ('00000000-0000-4000-8000-000000009611', 'Operational Test A', 'operational-test-a'),
  ('00000000-0000-4000-8000-000000009612', 'Operational Test B', 'operational-test-b');

insert into public.institution_memberships (
  id, institution_id, user_id, status, requested_role, reviewed_at, verified_at
)
values
  ('00000000-0000-4000-8000-000000009621',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009601', 'active', null, now(), now()),
  ('00000000-0000-4000-8000-000000009622',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009602', 'active', null, now(), now()),
  ('00000000-0000-4000-8000-000000009623',
    '00000000-0000-4000-8000-000000009612',
    '00000000-0000-4000-8000-000000009603', 'active', null, now(), now()),
  ('00000000-0000-4000-8000-000000009624',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009604', 'active', null, now(), now()),
  ('00000000-0000-4000-8000-000000009625',
    '00000000-0000-4000-8000-000000009612',
    '00000000-0000-4000-8000-000000009605', 'active', null, now(), now()),
  ('00000000-0000-4000-8000-000000009626',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009606', 'active', null, now(), now());

insert into public.institution_membership_roles (membership_id, role)
values
  ('00000000-0000-4000-8000-000000009621', 'student'),
  ('00000000-0000-4000-8000-000000009622', 'resource_owner'),
  ('00000000-0000-4000-8000-000000009623', 'resource_owner'),
  ('00000000-0000-4000-8000-000000009625', 'student'),
  ('00000000-0000-4000-8000-000000009626', 'institution_admin');

insert into public.resources (
  id, institution_id, owner_membership_id, owner_user_id, name, category,
  location, description, approval_mode, listed
)
values
  ('00000000-0000-4000-8000-000000009631',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009622',
    '00000000-0000-4000-8000-000000009602',
    'Operational resource A', 'Equipment', 'Test lab',
    'A test resource with sufficient description length.', 'owner', true),
  ('00000000-0000-4000-8000-000000009632',
    '00000000-0000-4000-8000-000000009612',
    '00000000-0000-4000-8000-000000009623',
    '00000000-0000-4000-8000-000000009603',
    'Operational resource B', 'Equipment', 'Test lab',
    'A test resource with sufficient description length.', 'owner', true);

insert into public.bookings (
  id, institution_id, resource_id, requester_membership_id, requester_user_id,
  starts_at, ends_at, purpose, status
)
values
  ('00000000-0000-4000-8000-000000009641',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009631',
    '00000000-0000-4000-8000-000000009621',
    '00000000-0000-4000-8000-000000009601',
    now() - interval '1 hour', now() + interval '1 hour',
    'Student check-out and check-in test', 'approved'),
  ('00000000-0000-4000-8000-000000009642',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009631',
    '00000000-0000-4000-8000-000000009621',
    '00000000-0000-4000-8000-000000009601',
    now() - interval '4 hours', now() - interval '3 hours',
    'Manager check-out and check-in test', 'approved'),
  ('00000000-0000-4000-8000-000000009643',
    '00000000-0000-4000-8000-000000009611',
    '00000000-0000-4000-8000-000000009631',
    '00000000-0000-4000-8000-000000009621',
    '00000000-0000-4000-8000-000000009601',
    now() - interval '8 hours', now() - interval '7 hours',
    'Invalid state report booking', 'pending'),
  ('00000000-0000-4000-8000-000000009644',
    '00000000-0000-4000-8000-000000009612',
    '00000000-0000-4000-8000-000000009632',
    '00000000-0000-4000-8000-000000009625',
    '00000000-0000-4000-8000-000000009605',
    now() - interval '1 hour', now() + interval '1 hour',
    'Cross institution access test', 'approved');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009601', true);

select lives_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009641',
    'check_out', 'good', '', array['Item condition checked']
  )$$,
  'An active student can check out their own due booking'
);
select is(
  (select recorded_by::text from public.condition_reports
   where booking_id = '00000000-0000-4000-8000-000000009641'
     and phase = 'check_out'),
  '00000000-0000-4000-8000-000000009601',
  'The handover actor comes from the authenticated session'
);
select lives_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009641',
    'check_in', 'good', '', array['Returned condition checked']
  )$$,
  'The student can check in the in-use booking they checked out'
);
select is(
  (select status from public.bookings
   where id = '00000000-0000-4000-8000-000000009641'),
  'completed',
  'Check-in preserves the booking lifecycle transition to completed'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009602', true);
select lives_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009642',
    'check_out', 'good', '', array['Manager inspected item']
  )$$,
  'A resource manager can check out a booking for their managed resource'
);
select lives_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009642',
    'check_in', 'good', '', array['Manager confirmed return']
  )$$,
  'A resource manager can check in the same booking after check-out'
);
select is(
  (select recorded_by::text from public.condition_reports
   where booking_id = '00000000-0000-4000-8000-000000009642'
     and phase = 'check_in'),
  '00000000-0000-4000-8000-000000009602',
  'The resource manager actor comes from the authenticated session'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009606', true);
select throws_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009642',
    'check_out', 'good', '', array['Administrator attempt']
  )$$,
  '42501',
  'Booking participant authorization required.',
  'An institutional administrator cannot record handovers without the operational resource-owner role'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009602', true);
select throws_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009644',
    'check_out', 'good', '', array['Cross institution attempt']
  )$$,
  '42501',
  'Booking participant authorization required.',
  'A resource manager cannot submit a report for another institution resource'
);
select throws_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009643',
    'check_out', 'good', '', array['Invalid state attempt']
  )$$,
  '55000',
  'Only a due approved booking can be checked out.',
  'A handover report is rejected when the booking is not in an eligible state'
);
select throws_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009699',
    'check_out', 'good', '', array['Invalid booking attempt']
  )$$,
  'P0002',
  'Booking not found.',
  'A handover report is rejected for an invalid booking'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009604', true);
select throws_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009642',
    'check_out', 'good', '', array['Unauthorised attempt']
  )$$,
  '42501',
  'Booking participant authorization required.',
  'A user without the booking participant role cannot submit a handover report'
);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.record_booking_condition_report(
    '00000000-0000-4000-8000-000000009642',
    'check_out', 'good', '', array['Unauthenticated attempt']
  )$$,
  '42501',
  'Authentication required.',
  'An unauthenticated user cannot submit a handover report'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009601', true);
select lives_ok(
  $$select public.report_resource_incident(
    '00000000-0000-4000-8000-000000009631',
    '00000000-0000-4000-8000-000000009641',
    'medium', 'Test incident', 'A sufficiently detailed incident description.'
  )$$,
  'An authenticated student can report an incident for their own booking'
);
select is(
  (select count(*)::integer from public.incident_events
   where incident_id = (
     select id from public.incidents
     where reporter_user_id = '00000000-0000-4000-8000-000000009601'
       and title = 'Test incident'
   )
     and from_status is null and to_status = 'open'),
  1,
  'Incident creation persists its initial incident event'
);
select is(
  (select count(*)::integer from public.activity_events
   where incident_id = (
     select id from public.incidents
     where reporter_user_id = '00000000-0000-4000-8000-000000009601'
       and title = 'Test incident'
   )
     and event_type = 'incident_reported'),
  1,
  'Incident creation persists the corresponding activity event'
);
select is(
  (select reporter_user_id::text from public.incidents
   where title = 'Test incident'),
  '00000000-0000-4000-8000-000000009601',
  'Incident reporter is derived from the authenticated session'
);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.report_resource_incident(
    '00000000-0000-4000-8000-000000009631',
    null, 'low', 'Unauthenticated report', 'A sufficiently detailed incident description.'
  )$$,
  '42501',
  'Authentication required.',
  'An unauthenticated user cannot create an incident'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009602', true);
select lives_ok(
  $$select public.update_resource_incident(
    (select id from public.incidents where title = 'Test incident'),
    'investigating',
    'Manager started an investigation.'
  )$$,
  'The resource manager can update an incident on their resource'
);
select is(
  (select count(*)::integer from public.incident_events
   where incident_id = (
     select id from public.incidents where title = 'Test incident'
   )
     and from_status = 'open'
     and to_status = 'investigating'
     and actor_id = '00000000-0000-4000-8000-000000009602'),
  1,
  'An authorised status update persists an actor-attributed incident event'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009603', true);
select lives_ok(
  $$select public.report_resource_incident(
    '00000000-0000-4000-8000-000000009632',
    null, 'low', 'Institution B incident', 'A sufficiently detailed incident description.'
  )$$,
  'A resource manager can create an incident for their own resource without a booking'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009602', true);
select throws_ok(
  $$select public.update_resource_incident(
    (select id from public.incidents where title = 'Institution B incident'),
    'resolved',
    'Cross institution update attempt.'
  )$$,
  '42501',
  'Active resource owner authorization required.',
  'A resource manager cannot update another institution incident'
);
select is(
  (select count(*)::integer from public.incidents
   where title = 'Institution B incident'),
  0,
  'Incident RLS hides another institution incident'
);
select is(
  (select count(*)::integer from public.activity_events
   where institution_id = '00000000-0000-4000-8000-000000009612'),
  0,
  'Activity RLS hides another institution activity'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009604', true);
select is(
  (select count(*)::integer from public.activity_events
   where institution_id = '00000000-0000-4000-8000-000000009611'),
  0,
  'A user without an operational role cannot read institution activity'
);

select * from finish();
rollback;
