CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

SELECT no_plan();

BEGIN;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000009401', 'authenticated', 'authenticated',
    'reservation-concurrency-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009402', 'authenticated', 'authenticated',
    'reservation-concurrency-limit@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009403', 'authenticated', 'authenticated',
    'reservation-concurrency-idempotency@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009404', 'authenticated', 'authenticated',
    'reservation-concurrency-stale@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009405', 'authenticated', 'authenticated',
    'reservation-concurrency-resource-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009406', 'authenticated', 'authenticated',
    'reservation-concurrency-resource-b@example.invalid', '', now(), '{}', '{}', now(), now());

INSERT INTO public.institutions (id, name, slug)
VALUES (
  '00000000-0000-4000-8000-000000009411',
  'Reservation Concurrency Test',
  'reservation-concurrency-test'
);

INSERT INTO public.institution_memberships (
  id, institution_id, user_id, status, requested_role, reviewed_at, verified_at
)
VALUES
  ('00000000-0000-4000-8000-000000009421',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009401', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009422',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009402', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009423',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009403', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009424',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009404', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009425',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009405', 'active', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000009426',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009406', 'active', NULL, now(), now());

INSERT INTO public.institution_membership_roles (membership_id, role)
VALUES
  ('00000000-0000-4000-8000-000000009421', 'resource_owner'),
  ('00000000-0000-4000-8000-000000009422', 'student'),
  ('00000000-0000-4000-8000-000000009423', 'student'),
  ('00000000-0000-4000-8000-000000009424', 'student'),
  ('00000000-0000-4000-8000-000000009425', 'student'),
  ('00000000-0000-4000-8000-000000009426', 'student');

INSERT INTO public.resources (
  id, institution_id, owner_membership_id, owner_user_id, name, category,
  location, description, approval_mode, listed
)
VALUES
  ('00000000-0000-4000-8000-000000009431',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009421',
    '00000000-0000-4000-8000-000000009401',
    'Concurrent equipment one', 'Equipment', 'Test lab',
    'A test resource with sufficient description length.', 'owner', true),
  ('00000000-0000-4000-8000-000000009432',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009421',
    '00000000-0000-4000-8000-000000009401',
    'Concurrent equipment two', 'Equipment', 'Test lab',
    'A test resource with sufficient description length.', 'owner', true),
  ('00000000-0000-4000-8000-000000009433',
    '00000000-0000-4000-8000-000000009411',
    '00000000-0000-4000-8000-000000009421',
    '00000000-0000-4000-8000-000000009401',
    'Concurrent equipment three', 'Equipment', 'Test lab',
    'A test resource with sufficient description length.', 'owner', true);

UPDATE public.resources
SET approval_mode = 'automatic'
WHERE id = '00000000-0000-4000-8000-000000009431';

INSERT INTO resourcehub_private.institution_reservation_limits (
  institution_id,
  max_active_reservations_per_user,
  max_concurrent_resources_per_user
)
VALUES ('00000000-0000-4000-8000-000000009411', 1, 10);

INSERT INTO resourcehub_private.booking_request_rate_limits (
  requester_user_id, recent_attempts
)
VALUES ('00000000-0000-4000-8000-000000009404', '{}');

COMMIT;

CREATE TEMP TABLE reservation_concurrency_results (
  case_name text NOT NULL,
  booking_id uuid NOT NULL
);
CREATE TEMP TABLE reservation_concurrency_state (
  stale_request_waited boolean NOT NULL,
  stale_start_at timestamptz NOT NULL
);

SELECT extensions.dblink_connect(
  'reservation_limit_a',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_limit_a'
);
SELECT extensions.dblink_connect(
  'reservation_limit_b',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_limit_b'
);
SELECT extensions.dblink_exec('reservation_limit_a', 'SET ROLE authenticated');
SELECT extensions.dblink_exec('reservation_limit_b', 'SET ROLE authenticated');
SELECT extensions.dblink_exec(
  'reservation_limit_a',
  'SET request.jwt.claim.sub = ''00000000-0000-4000-8000-000000009402'''
);
SELECT extensions.dblink_exec(
  'reservation_limit_b',
  'SET request.jwt.claim.sub = ''00000000-0000-4000-8000-000000009402'''
);

SELECT extensions.dblink_send_query(
  'reservation_limit_a',
  $query$
    SELECT public.request_resource_booking(
      '00000000-0000-4000-8000-000000009431',
      '2035-01-02 10:00:00+00',
      '2035-01-02 11:00:00+00',
      'Concurrent active limit request A',
      '00000000-0000-4000-8000-000000009451'
    )
  $query$
);
SELECT extensions.dblink_send_query(
  'reservation_limit_b',
  $query$
    SELECT public.request_resource_booking(
      '00000000-0000-4000-8000-000000009432',
      '2035-01-02 10:00:00+00',
      '2035-01-02 11:00:00+00',
      'Concurrent active limit request B',
      '00000000-0000-4000-8000-000000009452'
    )
  $query$
);

INSERT INTO reservation_concurrency_results
SELECT 'active-limit', result.booking_id
FROM extensions.dblink_get_result('reservation_limit_a', false)
  AS result(booking_id uuid);
INSERT INTO reservation_concurrency_results
SELECT 'active-limit', result.booking_id
FROM extensions.dblink_get_result('reservation_limit_b', false)
  AS result(booking_id uuid);
SELECT * FROM extensions.dblink_get_result('reservation_limit_a', false)
  AS result(booking_id uuid);
SELECT * FROM extensions.dblink_get_result('reservation_limit_b', false)
  AS result(booking_id uuid);

SELECT is(
  (SELECT pg_catalog.count(*) FROM reservation_concurrency_results
   WHERE case_name = 'active-limit'),
  1::bigint,
  'Concurrent booking sessions cannot exceed the per-user active reservation limit'
);
SELECT is(
  (SELECT pg_catalog.count(*) FROM public.bookings
   WHERE requester_user_id = '00000000-0000-4000-8000-000000009402'),
  1::bigint,
  'Exactly one concurrent active-limit request creates a booking'
);

SELECT extensions.dblink_connect(
  'reservation_idempotency_a',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_idempotency_a'
);
SELECT extensions.dblink_connect(
  'reservation_idempotency_b',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_idempotency_b'
);
SELECT extensions.dblink_exec('reservation_idempotency_a', 'SET ROLE authenticated');
SELECT extensions.dblink_exec('reservation_idempotency_b', 'SET ROLE authenticated');
SELECT extensions.dblink_exec(
  'reservation_idempotency_a',
  'SET request.jwt.claim.sub = ''00000000-0000-4000-8000-000000009403'''
);
SELECT extensions.dblink_exec(
  'reservation_idempotency_b',
  'SET request.jwt.claim.sub = ''00000000-0000-4000-8000-000000009403'''
);

SELECT extensions.dblink_send_query(
  'reservation_idempotency_a',
  $query$
    SELECT public.request_resource_booking(
      '00000000-0000-4000-8000-000000009433',
      '2035-01-03 10:00:00+00',
      '2035-01-03 11:00:00+00',
      'Concurrent idempotent request',
      '00000000-0000-4000-8000-000000009453'
    )
  $query$
);
SELECT extensions.dblink_send_query(
  'reservation_idempotency_b',
  $query$
    SELECT public.request_resource_booking(
      '00000000-0000-4000-8000-000000009433',
      '2035-01-03 10:00:00+00',
      '2035-01-03 11:00:00+00',
      'Concurrent idempotent request',
      '00000000-0000-4000-8000-000000009453'
    )
  $query$
);

INSERT INTO reservation_concurrency_results
SELECT 'idempotency', result.booking_id
FROM extensions.dblink_get_result('reservation_idempotency_a', true)
  AS result(booking_id uuid);
INSERT INTO reservation_concurrency_results
SELECT 'idempotency', result.booking_id
FROM extensions.dblink_get_result('reservation_idempotency_b', true)
  AS result(booking_id uuid);
SELECT * FROM extensions.dblink_get_result('reservation_idempotency_a', false)
  AS result(booking_id uuid);
SELECT * FROM extensions.dblink_get_result('reservation_idempotency_b', false)
  AS result(booking_id uuid);

SELECT is(
  (SELECT pg_catalog.count(*) FROM reservation_concurrency_results
   WHERE case_name = 'idempotency'),
  2::bigint,
  'Two concurrent same-key requests both receive a booking reference'
);
SELECT is(
  (SELECT pg_catalog.count(DISTINCT booking_id)
   FROM reservation_concurrency_results WHERE case_name = 'idempotency'),
  1::bigint,
  'Two concurrent same-key requests return the same booking'
);
SELECT is(
  (SELECT pg_catalog.count(*) FROM public.bookings
   WHERE requester_user_id = '00000000-0000-4000-8000-000000009403'),
  1::bigint,
  'Two concurrent same-key requests create only one booking'
);

SELECT extensions.dblink_connect(
  'reservation_resource_a',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_resource_a'
);
SELECT extensions.dblink_connect(
  'reservation_resource_b',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_resource_b'
);
SELECT extensions.dblink_exec('reservation_resource_a', 'SET ROLE authenticated');
SELECT extensions.dblink_exec('reservation_resource_b', 'SET ROLE authenticated');
SELECT extensions.dblink_exec(
  'reservation_resource_a',
  'SET request.jwt.claim.sub = ''00000000-0000-4000-8000-000000009405'''
);
SELECT extensions.dblink_exec(
  'reservation_resource_b',
  'SET request.jwt.claim.sub = ''00000000-0000-4000-8000-000000009406'''
);

SELECT extensions.dblink_send_query(
  'reservation_resource_a',
  $query$
    SELECT public.request_resource_booking(
      '00000000-0000-4000-8000-000000009431',
      '2036-01-02 10:00:00+00',
      '2036-01-02 11:00:00+00',
      'Concurrent same-resource booking A',
      '00000000-0000-4000-8000-000000009455'
    )
  $query$
);
SELECT extensions.dblink_send_query(
  'reservation_resource_b',
  $query$
    SELECT public.request_resource_booking(
      '00000000-0000-4000-8000-000000009431',
      '2036-01-02 10:00:00+00',
      '2036-01-02 11:00:00+00',
      'Concurrent same-resource booking B',
      '00000000-0000-4000-8000-000000009456'
    )
  $query$
);

INSERT INTO reservation_concurrency_results
SELECT 'same-resource', result.booking_id
FROM extensions.dblink_get_result('reservation_resource_a', false)
  AS result(booking_id uuid);
INSERT INTO reservation_concurrency_results
SELECT 'same-resource', result.booking_id
FROM extensions.dblink_get_result('reservation_resource_b', false)
  AS result(booking_id uuid);
SELECT * FROM extensions.dblink_get_result('reservation_resource_a', false)
  AS result(booking_id uuid);
SELECT * FROM extensions.dblink_get_result('reservation_resource_b', false)
  AS result(booking_id uuid);

SELECT is(
  (SELECT pg_catalog.count(*) FROM reservation_concurrency_results
   WHERE case_name = 'same-resource'),
  1::bigint,
  'Concurrent requests from different users cannot confirm overlapping bookings for one resource'
);
SELECT is(
  (SELECT pg_catalog.count(*) FROM public.bookings
   WHERE resource_id = '00000000-0000-4000-8000-000000009431'
     AND starts_at = '2036-01-02 10:00:00+00'
     AND status = 'approved'),
  1::bigint,
  'Resource-level conflict protection persists exactly one confirmed booking'
);

SELECT extensions.dblink_connect(
  'reservation_stale_lock',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_stale_lock'
);
SELECT extensions.dblink_connect(
  'reservation_stale_rpc',
  'dbname=' || current_database() || ' user=postgres application_name=reservation_stale_rpc'
);
SELECT extensions.dblink_exec('reservation_stale_lock', 'BEGIN');
SELECT *
FROM extensions.dblink(
  'reservation_stale_lock',
  $query$
    SELECT requester_user_id
    FROM resourcehub_private.booking_request_rate_limits
    WHERE requester_user_id = '00000000-0000-4000-8000-000000009404'
    FOR UPDATE
  $query$
) AS lock_row(requester_user_id uuid);
SELECT extensions.dblink_exec('reservation_stale_rpc', 'SET ROLE authenticated');
SELECT extensions.dblink_exec(
  'reservation_stale_rpc',
  'SET request.jwt.claim.sub = ''00000000-0000-4000-8000-000000009404'''
);

DO $$
DECLARE
  v_start_at timestamptz := pg_catalog.clock_timestamp() + interval '4 seconds';
  v_query text;
  v_waited boolean := false;
  v_attempt integer;
BEGIN
  v_query := pg_catalog.format(
    'SELECT public.request_resource_booking(%L::uuid, %L::timestamptz, %L::timestamptz, %L, %L::uuid)',
    '00000000-0000-4000-8000-000000009431',
    v_start_at,
    v_start_at + interval '1 hour',
    'Booking start passes while waiting on rate lock',
    '00000000-0000-4000-8000-000000009454'
  );

  IF extensions.dblink_send_query('reservation_stale_rpc', v_query) <> 1 THEN
    RAISE EXCEPTION 'Could not start the stale-start concurrency request.';
  END IF;

  FOR v_attempt IN 1..100 LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity AS activity
      WHERE activity.application_name = 'reservation_stale_rpc'
        AND activity.wait_event_type = 'Lock'
    )
    INTO v_waited;
    EXIT WHEN v_waited;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;

  PERFORM pg_catalog.pg_sleep(
    GREATEST(
      0,
      EXTRACT(EPOCH FROM (v_start_at + interval '0.1 seconds'
        - pg_catalog.clock_timestamp()))::double precision
    )
  );

  PERFORM extensions.dblink_exec('reservation_stale_lock', 'COMMIT');

  INSERT INTO reservation_concurrency_state (stale_request_waited, stale_start_at)
  VALUES (v_waited, v_start_at);
END;
$$;

INSERT INTO reservation_concurrency_results
SELECT 'stale-start', result.booking_id
FROM extensions.dblink_get_result('reservation_stale_rpc', false)
  AS result(booking_id uuid);
SELECT * FROM extensions.dblink_get_result('reservation_stale_rpc', false)
  AS result(booking_id uuid);

SELECT ok(
  (SELECT stale_request_waited FROM reservation_concurrency_state),
  'The booking request was blocked on a concurrent database lock'
);
SELECT is(
  (SELECT pg_catalog.count(*) FROM reservation_concurrency_results
   WHERE case_name = 'stale-start'),
  0::bigint,
  'A booking is rejected if its start passes while waiting for a lock'
);
SELECT is(
  (SELECT pg_catalog.count(*) FROM public.bookings
   WHERE requester_user_id = '00000000-0000-4000-8000-000000009404'),
  0::bigint,
  'The stale-start lock wait does not persist a booking'
);

SELECT extensions.dblink_disconnect('reservation_limit_a');
SELECT extensions.dblink_disconnect('reservation_limit_b');
SELECT extensions.dblink_disconnect('reservation_idempotency_a');
SELECT extensions.dblink_disconnect('reservation_idempotency_b');
SELECT extensions.dblink_disconnect('reservation_resource_a');
SELECT extensions.dblink_disconnect('reservation_resource_b');
SELECT extensions.dblink_disconnect('reservation_stale_lock');
SELECT extensions.dblink_disconnect('reservation_stale_rpc');

DELETE FROM public.notifications
WHERE institution_id = '00000000-0000-4000-8000-000000009411';
DELETE FROM public.activity_events
WHERE institution_id = '00000000-0000-4000-8000-000000009411';
DELETE FROM public.bookings
WHERE institution_id = '00000000-0000-4000-8000-000000009411';
DELETE FROM public.resources
WHERE institution_id = '00000000-0000-4000-8000-000000009411';
DELETE FROM public.institution_membership_roles
WHERE membership_id BETWEEN
  '00000000-0000-4000-8000-000000009421'::uuid
  AND '00000000-0000-4000-8000-000000009426'::uuid;
DELETE FROM public.institution_memberships
WHERE institution_id = '00000000-0000-4000-8000-000000009411';
DELETE FROM resourcehub_private.institution_reservation_limits
WHERE institution_id = '00000000-0000-4000-8000-000000009411';
DELETE FROM resourcehub_private.booking_request_rate_limits
WHERE requester_user_id IN (
  '00000000-0000-4000-8000-000000009402',
  '00000000-0000-4000-8000-000000009403',
  '00000000-0000-4000-8000-000000009404'
);
DELETE FROM public.institutions
WHERE id = '00000000-0000-4000-8000-000000009411';
DELETE FROM auth.users
WHERE id BETWEEN
  '00000000-0000-4000-8000-000000009401'::uuid
  AND '00000000-0000-4000-8000-000000009406'::uuid;

SELECT * FROM finish();
