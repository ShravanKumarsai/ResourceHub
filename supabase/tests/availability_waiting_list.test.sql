BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000009811', 'authenticated', 'authenticated',
    'availability-student-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009812', 'authenticated', 'authenticated',
    'availability-student-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009813', 'authenticated', 'authenticated',
    'availability-student-other@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009814', 'authenticated', 'authenticated',
    'availability-resource-owner@example.invalid', '', now(), '{}', '{}', now(), now());

INSERT INTO public.institutions (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000009815', 'Availability Test Institution', 'availability-test'),
  ('00000000-0000-4000-8000-000000009816', 'Availability Other Institution', 'availability-other');

INSERT INTO public.institution_memberships (
  id, institution_id, user_id, status, reviewed_at, verified_at
)
VALUES
  ('00000000-0000-4000-8000-000000009817',
    '00000000-0000-4000-8000-000000009815',
    '00000000-0000-4000-8000-000000009811', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000009818',
    '00000000-0000-4000-8000-000000009815',
    '00000000-0000-4000-8000-000000009812', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000009819',
    '00000000-0000-4000-8000-000000009816',
    '00000000-0000-4000-8000-000000009813', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000009820',
    '00000000-0000-4000-8000-000000009815',
    '00000000-0000-4000-8000-000000009814', 'active', now(), now());

INSERT INTO public.institution_membership_roles (membership_id, role)
VALUES
  ('00000000-0000-4000-8000-000000009817', 'student'),
  ('00000000-0000-4000-8000-000000009818', 'student'),
  ('00000000-0000-4000-8000-000000009819', 'student'),
  ('00000000-0000-4000-8000-000000009820', 'resource_owner');

INSERT INTO public.resources (
  id, institution_id, owner_membership_id, owner_user_id, name, category,
  location, description, approval_mode, listed
)
VALUES
  ('00000000-0000-4000-8000-000000009821',
    '00000000-0000-4000-8000-000000009815',
    '00000000-0000-4000-8000-000000009820',
    '00000000-0000-4000-8000-000000009814',
    'Availability test machine', 'Equipment', 'Test lab',
    'A test resource with sufficient description length.', 'owner', true),
  ('00000000-0000-4000-8000-000000009822',
    '00000000-0000-4000-8000-000000009816',
    '00000000-0000-4000-8000-000000009819',
    '00000000-0000-4000-8000-000000009813',
    'Other institution machine', 'Equipment', 'Other lab',
    'A test resource with sufficient description length.', 'owner', true);

INSERT INTO public.bookings (
  id, institution_id, resource_id, requester_membership_id, requester_user_id,
  starts_at, ends_at, purpose, status
)
VALUES
  ('00000000-0000-4000-8000-000000009823',
    '00000000-0000-4000-8000-000000009815',
    '00000000-0000-4000-8000-000000009821',
    '00000000-0000-4000-8000-000000009817',
    '00000000-0000-4000-8000-000000009811',
    '2035-01-02 10:00:00+00', '2035-01-02 12:00:00+00',
    'Confirmed availability test booking', 'approved'),
  ('00000000-0000-4000-8000-000000009824',
    '00000000-0000-4000-8000-000000009815',
    '00000000-0000-4000-8000-000000009821',
    '00000000-0000-4000-8000-000000009817',
    '00000000-0000-4000-8000-000000009811',
    '2035-01-02 13:00:00+00', '2035-01-02 14:00:00+00',
    'Pending availability test booking', 'pending');

SELECT ok(
  (SELECT count(*) = 10
   FROM pg_catalog.pg_attribute AS attribute
   WHERE attribute.attrelid = 'public.waiting_list_entries'::regclass
     AND attribute.attname = ANY (ARRAY[
       'id', 'institution_id', 'resource_id', 'requester_membership_id',
       'requester_user_id', 'starts_at', 'ends_at', 'status', 'created_at',
       'updated_at'
     ])
     AND NOT attribute.attisdropped),
  'The pre-existing waiting-list table exposes every column used by its RPCs'
);
SELECT ok(
  (SELECT relation.relrowsecurity
   FROM pg_catalog.pg_class AS relation
   WHERE relation.oid = 'public.waiting_list_entries'::regclass),
  'The pre-existing waiting-list table retains row-level security'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    WHERE index_row.indrelid = 'public.waiting_list_entries'::regclass
      AND index_row.indisunique
      AND index_row.indisvalid
      AND pg_catalog.pg_get_indexdef(index_row.indexrelid)
        LIKE '%(resource_id, requester_user_id, starts_at, ends_at)%'
      AND pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid)
        ILIKE '%waiting%'
      AND pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid)
        ILIKE '%offered%'
      AND pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid)
        ILIKE '%accepted%'
  ),
  'The pre-existing table has the active-request partial unique index required by ON CONFLICT'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.waiting_list_entries'::regclass
      AND constraint_row.contype = 'c'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) ILIKE '%ends_at > starts_at%'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.waiting_list_entries'::regclass
      AND constraint_row.contype = 'c'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) ILIKE '%status%'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) ILIKE '%waiting%'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) ILIKE '%offered%'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) ILIKE '%accepted%'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) ILIKE '%expired%'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) ILIKE '%cancelled%'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.waiting_list_entries'::regclass
      AND constraint_row.contype = 'p'
  )
  AND (
    SELECT count(*) = 4
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.waiting_list_entries'::regclass
      AND constraint_row.contype = 'f'
  ),
  'The pre-existing table retains its primary key, interval/status checks and all four foreign keys'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009811', true);

SELECT is(
  (SELECT has_confirmed_conflict
   FROM public.get_resource_booking_availability(
     '00000000-0000-4000-8000-000000009821',
     '2035-01-02 11:00:00+00',
     '2035-01-02 11:30:00+00'
   )),
  true,
  'Availability detects an overlapping confirmed booking'
);
SELECT is(
  (SELECT has_pending_conflict
   FROM public.get_resource_booking_availability(
     '00000000-0000-4000-8000-000000009821',
     '2035-01-02 13:15:00+00',
     '2035-01-02 13:45:00+00'
   )),
  true,
  'Availability reports overlapping pending requests as a soft conflict'
);
SELECT is(
  (SELECT has_confirmed_conflict OR has_pending_conflict
   FROM public.get_resource_booking_availability(
     '00000000-0000-4000-8000-000000009821',
     '2035-01-02 12:00:00+00',
     '2035-01-02 13:00:00+00'
   )),
  false,
  'Adjacent half-open intervals do not conflict'
);
SELECT is(
  (SELECT resource_available AND NOT has_confirmed_conflict AND NOT has_pending_conflict
   FROM public.get_resource_booking_availability(
     '00000000-0000-4000-8000-000000009821',
     '2035-01-02 15:00:00+00',
     '2035-01-02 16:00:00+00'
   )),
  true,
  'An unblocked time is reported as available'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_resource_booking_availability(
    '00000000-0000-4000-8000-000000009821',
    '2035-01-02 12:00:00+00',
    '2035-01-02 11:00:00+00'
  )$$,
  '22023',
  'The requested time range is invalid.',
  'Availability rejects an invalid time interval'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009813', true);
SELECT throws_ok(
  $$SELECT * FROM public.get_resource_booking_availability(
    '00000000-0000-4000-8000-000000009821',
    '2035-01-02 11:00:00+00',
    '2035-01-02 11:30:00+00'
  )$$,
  '42501',
  'Active student membership required.',
  'A student from another institution cannot inspect booking conflicts'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009811', true);

SELECT lives_ok(
  $$SELECT public.join_resource_waiting_list(
    '00000000-0000-4000-8000-000000009821',
    '2035-01-02 11:00:00+00',
    '2035-01-02 11:30:00+00'
  )$$,
  'An eligible student can join the queue for a confirmed conflict'
);
SELECT throws_ok(
  $$SELECT public.join_resource_waiting_list(
    '00000000-0000-4000-8000-000000009821',
    '2035-01-02 11:00:00+00',
    '2035-01-02 11:30:00+00'
  )$$,
  '23505',
  'Already joined this waiting list.',
  'A duplicate active wait-list request is rejected'
);
SELECT is(
  (SELECT event_type FROM public.activity_events
   WHERE event_type = 'waiting_list_joined'
     AND resource_id = '00000000-0000-4000-8000-000000009821'
   ORDER BY created_at DESC LIMIT 1),
  'waiting_list_joined',
  'A successful queue join persists its activity event'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009812', true);
SELECT lives_ok(
  $$SELECT public.join_resource_waiting_list(
    '00000000-0000-4000-8000-000000009821',
    '2035-01-02 11:00:00+00',
    '2035-01-02 11:30:00+00'
  )$$,
  'A second eligible student can join the same exact-time queue'
);
SELECT is(
  (SELECT queue_position
   FROM public.list_my_resource_waiting_list()
   WHERE resource_id = '00000000-0000-4000-8000-000000009821'),
  2::bigint,
  'Queue rank follows creation order and only returns the authenticated user entry'
);
SELECT throws_ok(
  $$SELECT public.join_resource_waiting_list(
    '00000000-0000-4000-8000-000000009822',
    '2035-01-02 11:00:00+00',
    '2035-01-02 11:30:00+00'
  )$$,
  '42501',
  'Active student membership required.',
  'A student cannot join a queue for another institution'
);
SELECT throws_ok(
  $$SELECT public.join_resource_waiting_list(
    '00000000-0000-4000-8000-000000009821',
    '2035-01-02 12:00:00+00',
    '2035-01-02 13:00:00+00'
  )$$,
  '22023',
  'The requested time is not blocked by a confirmed booking.',
  'A waiting-list entry cannot be created for an unblocked interval'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009811', true);
SELECT throws_ok(
  $$SELECT public.cancel_resource_waiting_list(
    (SELECT id FROM public.waiting_list_entries
     WHERE requester_user_id = '00000000-0000-4000-8000-000000009812'
       AND resource_id = '00000000-0000-4000-8000-000000009821')
  )$$,
  'P0002',
  'Waiting-list entry not found.',
  'A user cannot cancel another user waiting-list entry'
);
SELECT lives_ok(
  $$SELECT public.cancel_resource_waiting_list(
    (SELECT id FROM public.waiting_list_entries
     WHERE requester_user_id = '00000000-0000-4000-8000-000000009811'
       AND resource_id = '00000000-0000-4000-8000-000000009821')
  )$$,
  'A user can cancel their own active waiting-list entry'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009812', true);
SELECT is(
  (SELECT queue_position
   FROM public.list_my_resource_waiting_list()
   WHERE resource_id = '00000000-0000-4000-8000-000000009821'),
  1::bigint,
  'Queue positions recalculate after an earlier entry is cancelled'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009811', true);
UPDATE public.resources
SET availability = 'unavailable'
WHERE id = '00000000-0000-4000-8000-000000009821';
SELECT is(
  (SELECT resource_available
   FROM public.get_resource_booking_availability(
     '00000000-0000-4000-8000-000000009821',
     '2035-01-02 15:00:00+00',
     '2035-01-02 16:00:00+00'
   )),
  false,
  'Unavailable resources are not reported as bookable'
);
UPDATE public.resources
SET availability = 'available'
WHERE id = '00000000-0000-4000-8000-000000009821';
UPDATE public.institutions
SET is_active = false
WHERE id = '00000000-0000-4000-8000-000000009815';
SELECT is(
  (SELECT resource_available
   FROM public.get_resource_booking_availability(
     '00000000-0000-4000-8000-000000009821',
     '2035-01-02 15:00:00+00',
     '2035-01-02 16:00:00+00'
   )),
  false,
  'Resources at inactive institutions are not reported as bookable'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009813', true);
SELECT is(
  (SELECT count(*)::integer FROM public.waiting_list_entries
   WHERE resource_id = '00000000-0000-4000-8000-000000009821'),
  0,
  'RLS prevents another institution user from reading wait-list records'
);
RESET ROLE;

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'public.get_resource_booking_availability(uuid,timestamp with time zone,timestamp with time zone)'::regprocedure)
  AND NOT has_function_privilege(
    'anon',
    'public.get_resource_booking_availability(uuid,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ),
  'Availability RPC is SECURITY DEFINER with a fixed search_path and no anonymous execution'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'public.list_my_resource_waiting_list()'::regprocedure)
  AND NOT has_function_privilege(
    'anon',
    'public.list_my_resource_waiting_list()',
    'EXECUTE'
  ),
  'Queue ranking RPC is SECURITY DEFINER with a fixed search_path and no anonymous execution'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'public.cancel_resource_waiting_list(uuid)'::regprocedure)
  AND NOT has_function_privilege(
    'anon',
    'public.cancel_resource_waiting_list(uuid)',
    'EXECUTE'
  ),
  'Cancellation RPC is SECURITY DEFINER with a fixed search_path and no anonymous execution'
);

SELECT * FROM finish();
ROLLBACK;
