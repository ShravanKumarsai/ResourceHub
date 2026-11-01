BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000009701', 'authenticated', 'authenticated',
    'archive-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009702', 'authenticated', 'authenticated',
    'archive-student@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009703', 'authenticated', 'authenticated',
    'archive-other-student@example.invalid', '', now(), '{}', '{}', now(), now());

INSERT INTO public.institutions (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000009711', 'Archive Test Institution', 'archive-test'),
  ('00000000-0000-4000-8000-000000009712', 'Other Archive Institution', 'other-archive-test');

INSERT INTO public.institution_memberships (
  id, institution_id, user_id, status, reviewed_at, verified_at
)
VALUES
  ('00000000-0000-4000-8000-000000009721',
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009701', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000009722',
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009702', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000009723',
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009703', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000009724',
    '00000000-0000-4000-8000-000000009712',
    '00000000-0000-4000-8000-000000009703', 'active', now(), now());

INSERT INTO public.institution_membership_roles (membership_id, role)
VALUES
  ('00000000-0000-4000-8000-000000009721', 'resource_owner'),
  ('00000000-0000-4000-8000-000000009722', 'student'),
  ('00000000-0000-4000-8000-000000009723', 'student'),
  ('00000000-0000-4000-8000-000000009724', 'resource_owner');

INSERT INTO public.resources (
  id, institution_id, owner_membership_id, owner_user_id, name, category,
  location, description, listed
)
VALUES
  ('00000000-0000-4000-8000-000000009731',
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009721',
    '00000000-0000-4000-8000-000000009701',
    'Archive target', 'Equipment', 'Test lab',
    'A sufficiently long description for the archive target.', true),
  ('00000000-0000-4000-8000-000000009732',
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009721',
    '00000000-0000-4000-8000-000000009701',
    'Busy resource', 'Equipment', 'Test lab',
    'A sufficiently long description for the busy resource.', true),
  ('00000000-0000-4000-8000-000000009733',
    '00000000-0000-4000-8000-000000009712',
    '00000000-0000-4000-8000-000000009724',
    '00000000-0000-4000-8000-000000009703',
    'Other owner resource', 'Equipment', 'Other lab',
    'A sufficiently long description for another owner resource.', true);

INSERT INTO public.bookings (
  id, institution_id, resource_id, requester_membership_id, requester_user_id,
  starts_at, ends_at, purpose, status
)
VALUES
  ('00000000-0000-4000-8000-000000009741',
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009731',
    '00000000-0000-4000-8000-000000009722',
    '00000000-0000-4000-8000-000000009702',
    now() - interval '3 hours', now() - interval '2 hours',
    'Completed historical booking', 'completed'),
  ('00000000-0000-4000-8000-000000009742',
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009732',
    '00000000-0000-4000-8000-000000009722',
    '00000000-0000-4000-8000-000000009702',
    now() + interval '1 day', now() + interval '2 days',
    'Pending booking prevents archive', 'pending');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009702',
  true
);
SELECT lives_ok(
  $$INSERT INTO public.resource_favorites (user_id, resource_id)
    VALUES (
      '00000000-0000-4000-8000-000000009702',
      '00000000-0000-4000-8000-000000009731'
    )$$,
  'A user can save a listed resource'
);
SELECT throws_ok(
  $$INSERT INTO public.resource_favorites (user_id, resource_id)
    VALUES (
      '00000000-0000-4000-8000-000000009703',
      '00000000-0000-4000-8000-000000009731'
    )$$,
  '42501',
  'new row violates row-level security policy for table "resource_favorites"',
  'A user cannot create a favorite for another account'
);
SELECT throws_ok(
  $$UPDATE public.resource_favorites
    SET resource_id = '00000000-0000-4000-8000-000000009732'
    WHERE user_id = '00000000-0000-4000-8000-000000009702'$$,
  '42501',
  'permission denied for table resource_favorites',
  'Favorites do not grant clients update access'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009703',
  true
);
SELECT is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.resource_favorites
   WHERE user_id = '00000000-0000-4000-8000-000000009702'),
  0,
  'A user cannot read another account’s saved resources'
);
SELECT throws_ok(
  $$INSERT INTO public.resource_favorites (user_id, resource_id)
    VALUES (
      '00000000-0000-4000-8000-000000009703',
      '00000000-0000-4000-8000-000000009733'
    )$$,
  '42501',
  'new row violates row-level security policy for table "resource_favorites"',
  'A user cannot favorite a resource at an institution where it is not publicly listed'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009701',
  true
);
SELECT throws_ok(
  $$SELECT public.archive_resource('00000000-0000-4000-8000-000000009732')$$,
  '23514',
  'Resource has active bookings and cannot be archived.',
  'A resource with active bookings cannot be archived'
);
SELECT lives_ok(
  $$SELECT public.archive_resource('00000000-0000-4000-8000-000000009731')$$,
  'An owner can archive a resource after active bookings finish'
);
SELECT throws_ok(
  $$SELECT public.archive_resource('00000000-0000-4000-8000-000000009733')$$,
  '42501',
  'Resource not found or you do not own it.',
  'An owner cannot archive another institution’s resource'
);
RESET ROLE;

SELECT ok(
  (SELECT archived_at IS NOT NULL AND NOT listed
   FROM public.resources
   WHERE id = '00000000-0000-4000-8000-000000009731'),
  'Archiving timestamps the resource and removes it from listings'
);
SELECT is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.bookings
   WHERE resource_id = '00000000-0000-4000-8000-000000009731'),
  1,
  'Archiving preserves the resource booking history'
);
SELECT is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.resource_favorites
   WHERE resource_id = '00000000-0000-4000-8000-000000009731'),
  1,
  'Archiving preserves saved-resource rows'
);
SELECT is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.activity_events
   WHERE resource_id = '00000000-0000-4000-8000-000000009731'
     AND event_type = 'resource_archived'
     AND actor_id = '00000000-0000-4000-8000-000000009701'),
  1,
  'Archiving records a clear actor-attributed resource retirement event'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009702',
  true
);
SELECT throws_ok(
  $$SELECT public.restore_resource('00000000-0000-4000-8000-000000009731')$$,
  '42501',
  'Resource not found or you do not own it.',
  'A non-owner cannot restore another user’s archived resource'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009702',
  true
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009731',
    now() + interval '5 days',
    now() + interval '5 days 1 hour',
    'Legacy four-argument booking compatibility test'
  )$$,
  'P0002',
  'Resource is unavailable.',
  'The legacy booking RPC rejects archived resources'
);
SELECT throws_ok(
  $$SELECT public.request_resource_booking(
    '00000000-0000-4000-8000-000000009731',
    now() + interval '6 days',
    now() + interval '6 days 1 hour',
    'Idempotent archived booking compatibility test',
    '00000000-0000-4000-8000-000000009751'
  )$$,
  'P0002',
  'Resource is unavailable.',
  'The idempotent booking RPC rejects archived resources'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009701',
  true
);
SELECT lives_ok(
  $$SELECT public.restore_resource('00000000-0000-4000-8000-000000009731')$$,
  'An owner can restore an archived resource'
);
RESET ROLE;
SELECT ok(
  (SELECT archived_at IS NULL AND NOT listed
   FROM public.resources
   WHERE id = '00000000-0000-4000-8000-000000009731'),
  'Restoration returns the resource as an unpublished draft'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.resources', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.resource_favorites', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.resource_favorites', 'SELECT'),
  'Resource deletion and unauthorized favorite access are not granted'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_catalog.pg_proc
   WHERE oid = 'public.archive_resource(uuid)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
       FROM pg_catalog.pg_proc
       WHERE oid = 'public.restore_resource(uuid)'::regprocedure)
  AND has_function_privilege('authenticated', 'public.archive_resource(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.archive_resource(uuid)', 'EXECUTE'),
  'Archive and restore RPCs are authenticated security-definer functions with fixed search paths'
);
SELECT ok(
  (SELECT pg_catalog.count(*) = 1
   FROM pg_catalog.pg_trigger
   WHERE tgrelid = 'public.bookings'::regclass
     AND tgname = 'bookings_guard_archived_resource'
     AND NOT tgisinternal)
  AND position(
    'resource-retirement:'
    IN pg_catalog.pg_get_functiondef(
      'public.request_resource_booking(uuid,timestamp with time zone,timestamp with time zone,text)'::regprocedure
    )
  ) > 0,
  'Booking creation and archival use the same resource retirement lock'
);

SELECT * FROM finish();
ROLLBACK;
