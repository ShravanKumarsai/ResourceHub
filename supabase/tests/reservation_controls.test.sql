BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000009301', 'authenticated', 'authenticated',
    'reservation-admin-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009302', 'authenticated', 'authenticated',
    'reservation-admin-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009303', 'authenticated', 'authenticated',
    'reservation-student-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009304', 'authenticated', 'authenticated',
    'reservation-owner-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009305', 'authenticated', 'authenticated',
    'reservation-student-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009306', 'authenticated', 'authenticated',
    'reservation-owner-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009307', 'authenticated', 'authenticated',
    'reservation-student-a2@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009308', 'authenticated', 'authenticated',
    'reservation-student-a3@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009309', 'authenticated', 'authenticated',
    'reservation-applicant@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009310', 'authenticated', 'authenticated',
    'reservation-rejected-applicant@example.invalid', '', now(), '{}', '{}', now(), now());

INSERT INTO public.institutions (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000009311', 'Reservation Test A', 'reservation-test-a'),
  ('00000000-0000-4000-8000-000000009312', 'Reservation Test B', 'reservation-test-b');

INSERT INTO public.institution_memberships (
  id, institution_id, user_id, status, requested_role, reviewed_at, verified_at
)
VALUES
  ('00000000-0000-4000-8000-000000009321',
    '00000000-0000-4000-8000-000000009311',
    '00000000-0000-4000-8000-000000009301', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009322',
    '00000000-0000-4000-8000-000000009312',
    '00000000-0000-4000-8000-000000009302', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009323',
    '00000000-0000-4000-8000-000000009311',
    '00000000-0000-4000-8000-000000009303', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009324',
    '00000000-0000-4000-8000-000000009311',
    '00000000-0000-4000-8000-000000009304', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009325',
    '00000000-0000-4000-8000-000000009312',
    '00000000-0000-4000-8000-000000009305', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009326',
    '00000000-0000-4000-8000-000000009312',
    '00000000-0000-4000-8000-000000009306', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009327',
    '00000000-0000-4000-8000-000000009311',
    '00000000-0000-4000-8000-000000009307', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009328',
    '00000000-0000-4000-8000-000000009311',
    '00000000-0000-4000-8000-000000009308', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009329',
    '00000000-0000-4000-8000-000000009311',
    '00000000-0000-4000-8000-000000009309', 'pending', 'student', NULL, NULL),
  ('00000000-0000-4000-8000-000000009330',
    '00000000-0000-4000-8000-000000009311',
    '00000000-0000-4000-8000-000000009310', 'pending', 'resource_owner', NULL, NULL);

INSERT INTO public.institution_membership_roles (membership_id, role)
VALUES
  ('00000000-0000-4000-8000-000000009321', 'institution_admin'),
  ('00000000-0000-4000-8000-000000009322', 'institution_admin'),
  ('00000000-0000-4000-8000-000000009323', 'student'),
  ('00000000-0000-4000-8000-000000009324', 'resource_owner'),
  ('00000000-0000-4000-8000-000000009325', 'student'),
  ('00000000-0000-4000-8000-000000009326', 'resource_owner'),
  ('00000000-0000-4000-8000-000000009327', 'student'),
  ('00000000-0000-4000-8000-000000009328', 'student');

INSERT INTO public.resources (
  id, institution_id, owner_membership_id, owner_user_id, name, category,
  location, description, approval_mode, listed
)
SELECT
  ('00000000-0000-4000-8000-' || pg_catalog.lpad((9410 + resource_number)::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000009311',
  '00000000-0000-4000-8000-000000009324',
  '00000000-0000-4000-8000-000000009304',
  'Test equipment ' || resource_number,
  'Equipment',
  'Test lab',
  'A test resource with sufficient description length.',
  CASE WHEN resource_number = 12 THEN 'automatic' ELSE 'owner' END,
  true
FROM pg_catalog.generate_series(1, 12) AS resources(resource_number);

INSERT INTO public.resources (
  id, institution_id, owner_membership_id, owner_user_id, name, category,
  location, description, listed
)
VALUES
  (
    '00000000-0000-4000-8000-000000009431',
    '00000000-0000-4000-8000-000000009312',
    '00000000-0000-4000-8000-000000009326',
    '00000000-0000-4000-8000-000000009306',
    'Test equipment B1',
    'Equipment',
    'Test lab B',
    'A test resource with sufficient description length.',
    true
  ),
  (
    '00000000-0000-4000-8000-000000009432',
    '00000000-0000-4000-8000-000000009312',
    '00000000-0000-4000-8000-000000009326',
    '00000000-0000-4000-8000-000000009306',
    'Test equipment B2',
    'Equipment',
    'Test lab B',
    'A test resource with sufficient description length.',
    true
  ),
  (
    '00000000-0000-4000-8000-000000009433',
    '00000000-0000-4000-8000-000000009312',
    '00000000-0000-4000-8000-000000009326',
    '00000000-0000-4000-8000-000000009306',
    'Test equipment B3',
    'Equipment',
    'Test lab B',
    'A test resource with sufficient description length.',
    true
  );

SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

CREATE TEMP TABLE reservation_test_slots (
  slot_name text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL
) ON COMMIT DROP;
GRANT SELECT ON reservation_test_slots TO authenticated;

INSERT INTO reservation_test_slots (slot_name, starts_at, ends_at)
VALUES
  ('shared', now() + interval '10 days', now() + interval '10 days 1 hour'),
  ('adjacent', now() + interval '10 days 1 hour', now() + interval '10 days 2 hours'),
  ('separate', now() + interval '15 days', now() + interval '15 days 1 hour'),
  ('r5', now() + interval '20 days', now() + interval '20 days 1 hour'),
  ('r6', now() + interval '21 days', now() + interval '21 days 1 hour'),
  ('r7', now() + interval '22 days', now() + interval '22 days 1 hour'),
  ('r8', now() + interval '23 days', now() + interval '23 days 1 hour'),
  ('r9', now() + interval '24 days', now() + interval '24 days 1 hour'),
  ('r10', now() + interval '25 days', now() + interval '25 days 1 hour'),
  ('machine', now() + interval '40 days', now() + interval '40 days 1 hour'),
  ('legacy', now() + interval '45 days', now() + interval '45 days 1 hour'),
  ('review', now() + interval '50 days', now() + interval '50 days 1 hour');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009301', true);
SELECT lives_ok(
  $$SELECT public.set_institution_reservation_limits(
    '00000000-0000-4000-8000-000000009311', 10, 3
  )$$,
  'An active institution administrator can configure reservation limits'
);
SELECT is(
  (SELECT max_active_reservations_per_user
   FROM public.get_institution_reservation_limits(
     '00000000-0000-4000-8000-000000009311'
   )),
  10,
  'An administrator can read the configured active reservation limit'
);
SELECT is(
  (SELECT max_concurrent_resources_per_user
   FROM public.get_institution_reservation_limits(
     '00000000-0000-4000-8000-000000009311'
   )),
  3,
  'An administrator can read the configured overlapping resource limit'
);
SELECT throws_ok(
  $$SELECT public.set_institution_reservation_limits(
    '00000000-0000-4000-8000-000000009311', 11, 3
  )$$,
  '22023',
  'Reservation limits must be between 1 and 10.',
  'The configured active reservation limit cannot exceed 10'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009302', true);
SELECT throws_ok(
  $$SELECT public.set_institution_reservation_limits(
    '00000000-0000-4000-8000-000000009311', 5, 5
  )$$,
  '42501',
  'An active institution administrator is required.',
  'An administrator from another institution cannot change reservation limits'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_institution_reservation_limits(
    '00000000-0000-4000-8000-000000009311'
  )$$,
  '42501',
  'An active institution administrator is required.',
  'An administrator from another institution cannot read reservation limits'
);
SELECT is(
  (SELECT max_active_reservations_per_user
   FROM public.get_institution_reservation_limits(
     '00000000-0000-4000-8000-000000009312'
   )),
  3,
  'An institution without an override defaults to three active reservations'
);
SELECT is(
  (SELECT max_concurrent_resources_per_user
   FROM public.get_institution_reservation_limits(
     '00000000-0000-4000-8000-000000009312'
   )),
  2,
  'An institution without an override defaults to two overlapping resources'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009305', true);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009431',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Default concurrent limit first resource',
    '00000000-0000-4000-8000-000000009520'
  )$$,
  'The default concurrent limit allows the first resource'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009432',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Default concurrent limit second resource',
    '00000000-0000-4000-8000-000000009521'
  )$$,
  'The default concurrent limit allows two distinct resources simultaneously'
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009433',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Default concurrent limit third resource',
    '00000000-0000-4000-8000-000000009522'
  )$$,
  'P0001',
  'Overlapping resource limit reached.',
  'The default concurrent limit rejects a third simultaneous distinct resource'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009303', true);
SELECT is(
  public.request_resource_booking(
    '00000000-0000-4000-8000-000000009411',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Idempotent booking request test',
    '00000000-0000-4000-8000-000000009501'
  ),
  public.request_resource_booking(
    '00000000-0000-4000-8000-000000009411',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Idempotent booking request test',
    '00000000-0000-4000-8000-000000009501'
  ),
  'A repeated idempotency key and payload return the original booking'
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009411',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'A different request payload',
    '00000000-0000-4000-8000-000000009501'
  )$$,
  '22023',
  'The idempotency key was already used for a different booking request.',
  'A reused idempotency key cannot create a different booking'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009412',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Second concurrent resource test',
    '00000000-0000-4000-8000-000000009502'
  )$$,
  'A user can reserve a second distinct resource within slot capacity'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009413',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Third concurrent resource test',
    '00000000-0000-4000-8000-000000009503'
  )$$,
  'A user can reach the configured overlapping resource capacity'
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009414',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Fourth concurrent resource test',
    '00000000-0000-4000-8000-000000009504'
  )$$,
  'P0001',
  'Overlapping resource limit reached.',
  'Concurrent distinct-resource capacity is enforced'
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009411',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'shared'),
    'Duplicate equipment booking test',
    '00000000-0000-4000-8000-000000009505'
  )$$,
  '23P01',
  'You already have an overlapping booking for this resource.',
  'A user cannot create overlapping pending requests for the same equipment'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009414',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'separate'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'separate'),
    'Separate time slot request test',
    '00000000-0000-4000-8000-000000009506'
  )$$,
  'A user can reserve another resource outside the overlapping time slot'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009411',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'adjacent'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'adjacent'),
    'Adjacent booking interval test',
    '00000000-0000-4000-8000-000000009523'
  )$$,
  'Adjacent half-open time intervals on the same resource do not overlap'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009301', true);
SELECT lives_ok(
  $$SELECT public.set_institution_reservation_limits(
    '00000000-0000-4000-8000-000000009311', 3, 10
  )$$,
  'An institution administrator can lower the active reservation limit'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009303', true);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009415',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    'Active reservation cap test',
    '00000000-0000-4000-8000-000000009507'
  )$$,
  'P0001',
  'Active reservation limit reached.',
  'The institution active reservation limit is enforced'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009301', true);
SELECT lives_ok(
  $$SELECT public.set_institution_reservation_limits(
    '00000000-0000-4000-8000-000000009311', 10, 3
  )$$,
  'An institution administrator can raise the active limit up to 10'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009303', true);

SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009415',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    'Rate limit request five',
    '00000000-0000-4000-8000-000000009508'
  )$$,
  'A valid booking request is accepted below the durable rate limit'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009416',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r6'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r6'),
    'Rate limit request six',
    '00000000-0000-4000-8000-000000009509'
  )$$,
  'The sixth new booking request is accepted'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009417',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r7'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r7'),
    'Rate limit request seven',
    '00000000-0000-4000-8000-000000009510'
  )$$,
  'The seventh new booking request is accepted'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009418',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r8'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r8'),
    'Rate limit request eight',
    '00000000-0000-4000-8000-000000009511'
  )$$,
  'The eighth new booking request is accepted'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009419',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r9'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r9'),
    'Rate limit request nine',
    '00000000-0000-4000-8000-000000009512'
  )$$,
  'The ninth new booking request is accepted'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009420',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r10'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r10'),
    'Rate limit request ten',
    '00000000-0000-4000-8000-000000009513'
  )$$,
  'The tenth new booking request is accepted'
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009422',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    'Rate limit request eleven',
    '00000000-0000-4000-8000-000000009514'
  )$$,
  'P0001',
  'Booking request rate limit exceeded.',
  'The durable rolling rate limit rejects an eleventh new request'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009307', true);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009422',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'machine'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'machine'),
    'First confirmed machine reservation',
    '00000000-0000-4000-8000-000000009515'
  )$$,
  'An automatic booking is confirmed on its resource'
);
SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009420',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'legacy'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'legacy'),
    'Legacy four argument request test'
  )$$,
  'The existing four-argument booking RPC remains available to old clients'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009308', true);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009422',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'machine'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'machine'),
    'Overlapping confirmed machine reservation',
    '00000000-0000-4000-8000-000000009516'
  )$$,
  '23P01',
  'conflicting key value violates exclusion constraint "bookings_no_confirmed_overlap"',
  'The existing exclusion constraint prevents overlapping confirmed equipment bookings'
);

SELECT lives_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009421',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'review'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'review'),
    'Booking approval future-time test',
    '00000000-0000-4000-8000-000000009517'
  )$$,
  'A future pending booking can be created for approval testing'
);

RESET ROLE;
UPDATE public.bookings
SET starts_at = pg_catalog.clock_timestamp() - interval '1 minute'
WHERE requester_user_id = '00000000-0000-4000-8000-000000009307'
  AND resource_id = '00000000-0000-4000-8000-000000009421';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009304', true);
SELECT throws_ok(
  $$SELECT public.review_resource_booking(
    (SELECT id FROM public.bookings
     WHERE requester_user_id = '00000000-0000-4000-8000-000000009307'
       AND resource_id = '00000000-0000-4000-8000-000000009421'),
    'approved',
    NULL
  )$$,
  '55000',
  'Booking start time has passed or the institution is inactive.',
  'A resource manager cannot approve a booking after its start time'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009305', true);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009411',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    'Cross institution access test',
    '00000000-0000-4000-8000-000000009518'
  )$$,
  '42501',
  'Active student membership required.',
  'A student from another institution cannot request a resource'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009301', true);
SELECT lives_ok(
  $$SELECT public.review_institution_membership(
    '00000000-0000-4000-8000-000000009329',
    'active',
    ARRAY['student']
  )$$,
  'An administrator can approve the test applicant'
);
SELECT lives_ok(
  $$SELECT public.review_institution_membership(
    '00000000-0000-4000-8000-000000009330',
    'rejected',
    ARRAY[]::text[]
  )$$,
  'An administrator can reject the second test applicant'
);

RESET ROLE;
SELECT is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.notifications
   WHERE recipient_id = '00000000-0000-4000-8000-000000009309'
     AND institution_id = '00000000-0000-4000-8000-000000009311'
     AND title = 'Institution access approved'),
  1,
  'A pending-to-active membership transition creates one notification'
);
SELECT is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.notifications
   WHERE recipient_id = '00000000-0000-4000-8000-000000009310'
     AND institution_id = '00000000-0000-4000-8000-000000009311'
     AND title = 'Institution access not approved'),
  1,
  'A pending-to-rejected membership transition creates one notification'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009301', true);
SELECT throws_ok(
  $$SELECT public.update_institution_name(
    '00000000-0000-4000-8000-000000009311',
    NULL
  )$$,
  '22023',
  'Institution name is required.',
  'Institution rename rejects a NULL name explicitly'
);
SELECT throws_ok(
  $$SELECT public.update_institution_name(
    '00000000-0000-4000-8000-000000009311',
    '   '
  )$$,
  '22023',
  'Institution name is invalid.',
  'Institution rename rejects an empty trimmed name'
);
SELECT lives_ok(
  $$SELECT public.update_institution_name(
    '00000000-0000-4000-8000-000000009311',
    'Renamed Reservation Test A'
  )$$,
  'An active administrator can rename their active institution'
);

RESET ROLE;
UPDATE public.institutions
SET is_active = false
WHERE id = '00000000-0000-4000-8000-000000009312';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009302', true);
SELECT throws_ok(
  $$SELECT public.update_institution_name(
    '00000000-0000-4000-8000-000000009312',
    'Inactive institution'
  )$$,
  '42501',
  'Only active institution administrators can rename this institution.',
  'An administrator cannot rename an inactive institution'
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009431',
    (SELECT starts_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    (SELECT ends_at FROM reservation_test_slots WHERE slot_name = 'r5'),
    'Inactive institution booking test',
    '00000000-0000-4000-8000-000000009519'
  )$$,
  'P0002',
  'Resource is unavailable.',
  'An inactive institution cannot accept new bookings'
);

RESET ROLE;
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.bookings'::regclass
      AND constraint_row.conname = 'bookings_no_confirmed_overlap'
      AND constraint_row.contype = 'x'
  ),
  'The existing confirmed-booking exclusion constraint remains present'
);
SELECT ok(
  position(
    'pg_advisory_xact_lock'
    IN pg_catalog.pg_get_functiondef(
      'resourcehub_private.create_resource_booking(uuid,timestamp with time zone,timestamp with time zone,text,uuid)'::regprocedure
    )
  ) > 0,
  'Per-user booking checks retain transaction-scoped serialization'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'public.request_resource_booking(uuid,timestamp with time zone,timestamp with time zone,text,uuid)'::regprocedure),
  'The idempotent booking RPC is SECURITY DEFINER with an empty search_path'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'public.get_institution_reservation_limits(uuid)'::regprocedure)
  AND NOT has_function_privilege(
    'anon',
    'public.get_institution_reservation_limits(uuid)',
    'EXECUTE'
  ),
  'The reservation-limit reader has a fixed search_path and no anonymous execution'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'public.update_institution_name(uuid,text)'::regprocedure)
  AND NOT has_function_privilege(
    'anon',
    'public.update_institution_name(uuid,text)',
    'EXECUTE'
  ),
  'The institution rename RPC has a fixed search_path and no anonymous execution'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'resourcehub_private.notify_membership_review_result()'::regprocedure)
  AND (
    SELECT pg_catalog.count(*) = 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.institution_memberships'::regclass
      AND trigger_row.tgname = 'institution_memberships_notify_review_result'
      AND NOT trigger_row.tgisinternal
  ),
  'The membership notification trigger is unique and calls a locked-down function'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.request_resource_booking(uuid,timestamp with time zone,timestamp with time zone,text,uuid)',
    'EXECUTE'
  ),
  'Anonymous callers cannot execute booking creation'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'resourcehub_private.booking_request_idempotency',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'resourcehub_private.booking_request_rate_limits',
    'SELECT'
  ),
  'Authenticated users cannot read private idempotency or rate-limit state'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resources'
      AND policyname = 'Anyone can read listed resources at active institutions'
  )
  AND has_column_privilege('anon', 'public.resources', 'name', 'SELECT'),
  'Existing public resource discovery remains in place without recreation'
);

SELECT * FROM finish();
ROLLBACK;
