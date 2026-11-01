CREATE TABLE IF NOT EXISTS resourcehub_private.institution_reservation_limits (
  institution_id uuid PRIMARY KEY
    REFERENCES public.institutions(id) ON DELETE CASCADE,
  max_active_reservations_per_user integer NOT NULL DEFAULT 3
    CHECK (max_active_reservations_per_user BETWEEN 1 AND 10),
  max_concurrent_resources_per_user integer NOT NULL DEFAULT 2
    CHECK (max_concurrent_resources_per_user BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS resourcehub_private.booking_request_idempotency (
  requester_user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  resource_id uuid NOT NULL
    REFERENCES public.resources(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  purpose text NOT NULL,
  booking_id uuid NOT NULL UNIQUE
    REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (requester_user_id, idempotency_key),
  CHECK (ends_at > starts_at),
  CHECK (length(pg_catalog.btrim(purpose)) BETWEEN 15 AND 5000)
);

CREATE TABLE IF NOT EXISTS resourcehub_private.booking_request_rate_limits (
  requester_user_id uuid PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  recent_attempts timestamptz[] NOT NULL DEFAULT '{}',
  CHECK (pg_catalog.cardinality(recent_attempts) <= 10)
);

ALTER TABLE resourcehub_private.institution_reservation_limits
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE resourcehub_private.booking_request_idempotency
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE resourcehub_private.booking_request_rate_limits
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON resourcehub_private.institution_reservation_limits
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON resourcehub_private.booking_request_idempotency
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON resourcehub_private.booking_request_rate_limits
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_institution_reservation_limits(
  p_institution_id uuid,
  p_max_active_reservations integer,
  p_max_concurrent_resources integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_institution_active boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING errcode = '42501';
  END IF;

  IF p_max_active_reservations IS NULL
    OR p_max_concurrent_resources IS NULL
    OR p_max_active_reservations NOT BETWEEN 1 AND 10
    OR p_max_concurrent_resources NOT BETWEEN 1 AND 10
  THEN
    RAISE EXCEPTION 'Reservation limits must be between 1 and 10.'
      USING errcode = '22023';
  END IF;

  UPDATE resourcehub_private.admin_invariant_mutex
  SET generation = generation + 1
  WHERE singleton;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Administrator-invariant mutex is missing.'
      USING errcode = '55000';
  END IF;

  SELECT institution.is_active
  INTO v_institution_active
  FROM public.institutions AS institution
  WHERE institution.id = p_institution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Institution not found.'
      USING errcode = 'P0002';
  END IF;

  IF NOT v_institution_active
    OR NOT resourcehub_private.is_institution_admin(p_institution_id)
  THEN
    RAISE EXCEPTION 'An active institution administrator is required.'
      USING errcode = '42501';
  END IF;

  INSERT INTO resourcehub_private.institution_reservation_limits (
    institution_id,
    max_active_reservations_per_user,
    max_concurrent_resources_per_user,
    updated_at
  )
  VALUES (
    p_institution_id,
    p_max_active_reservations,
    p_max_concurrent_resources,
    pg_catalog.clock_timestamp()
  )
  ON CONFLICT (institution_id) DO UPDATE
  SET max_active_reservations_per_user = EXCLUDED.max_active_reservations_per_user,
      max_concurrent_resources_per_user = EXCLUDED.max_concurrent_resources_per_user,
      updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.set_institution_reservation_limits(uuid, integer, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_institution_reservation_limits(uuid, integer, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_institution_reservation_limits(p_institution_id uuid)
RETURNS TABLE (
  max_active_reservations_per_user integer,
  max_concurrent_resources_per_user integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING errcode = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.institutions AS institution
    WHERE institution.id = p_institution_id
      AND institution.is_active
  ) OR NOT resourcehub_private.is_institution_admin(p_institution_id) THEN
    RAISE EXCEPTION 'An active institution administrator is required.'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT COALESCE(limits.max_active_reservations_per_user, 3),
         COALESCE(limits.max_concurrent_resources_per_user, 2)
  FROM public.institutions AS institution
  LEFT JOIN resourcehub_private.institution_reservation_limits AS limits
    ON limits.institution_id = institution.id
  WHERE institution.id = p_institution_id
    AND institution.is_active;
END;
$$;

REVOKE ALL ON FUNCTION public.get_institution_reservation_limits(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_institution_reservation_limits(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION resourcehub_private.create_resource_booking(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_purpose text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz;
  v_resource public.resources%rowtype;
  v_membership_id uuid;
  v_booking_id uuid;
  v_status text;
  v_event_id uuid;
  v_existing_resource_id uuid;
  v_existing_starts_at timestamptz;
  v_existing_ends_at timestamptz;
  v_existing_purpose text;
  v_institution_active boolean;
  v_max_active integer;
  v_max_concurrent integer;
  v_active_count bigint;
  v_overlapping_resource_count bigint;
  v_recent_attempts timestamptz[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING errcode = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'An idempotency key is required.'
      USING errcode = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  SELECT request.resource_id, request.starts_at, request.ends_at,
         request.purpose, request.booking_id
  INTO v_existing_resource_id, v_existing_starts_at, v_existing_ends_at,
       v_existing_purpose, v_booking_id
  FROM resourcehub_private.booking_request_idempotency AS request
  WHERE request.requester_user_id = v_actor
    AND request.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_resource_id IS DISTINCT FROM p_resource_id
      OR v_existing_starts_at IS DISTINCT FROM p_starts_at
      OR v_existing_ends_at IS DISTINCT FROM p_ends_at
      OR v_existing_purpose IS DISTINCT FROM pg_catalog.btrim(p_purpose)
    THEN
      RAISE EXCEPTION 'The idempotency key was already used for a different booking request.'
        USING errcode = '22023';
    END IF;

    RETURN v_booking_id;
  END IF;

  IF p_starts_at IS NULL
    OR p_ends_at IS NULL
    OR p_ends_at <= p_starts_at
    OR p_starts_at <= v_now
    OR p_purpose IS NULL
    OR pg_catalog.length(pg_catalog.btrim(p_purpose)) NOT BETWEEN 15 AND 5000
  THEN
    RAISE EXCEPTION 'Booking details are invalid.'
      USING errcode = '22023';
  END IF;

  SELECT resource.*
  INTO v_resource
  FROM public.resources AS resource
  JOIN public.institutions AS institution
    ON institution.id = resource.institution_id
  WHERE resource.id = p_resource_id
    AND resource.listed
    AND resource.availability <> 'unavailable'
    AND institution.is_active
  FOR SHARE OF resource, institution;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource is unavailable.'
      USING errcode = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'resource-booking:' || v_resource.id::text,
      0
    )
  );

  IF p_ends_at - p_starts_at
    > pg_catalog.make_interval(hours => v_resource.max_duration_hours)
  THEN
    RAISE EXCEPTION 'Requested duration exceeds this resource limit.'
      USING errcode = '22023';
  END IF;

  SELECT institution.is_active,
         COALESCE(limits.max_active_reservations_per_user, 3),
         COALESCE(limits.max_concurrent_resources_per_user, 2)
  INTO v_institution_active, v_max_active, v_max_concurrent
  FROM public.institutions AS institution
  LEFT JOIN resourcehub_private.institution_reservation_limits AS limits
    ON limits.institution_id = institution.id
  WHERE institution.id = v_resource.institution_id;

  IF NOT FOUND OR NOT v_institution_active THEN
    RAISE EXCEPTION 'Resource is unavailable.'
      USING errcode = 'P0002';
  END IF;

  SELECT membership.id
  INTO v_membership_id
  FROM public.institution_memberships AS membership
  JOIN public.institution_membership_roles AS membership_role
    ON membership_role.membership_id = membership.id
  WHERE membership.institution_id = v_resource.institution_id
    AND membership.user_id = v_actor
    AND membership.status = 'active'
    AND membership_role.role = 'student'
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'Active student membership required.'
      USING errcode = '42501';
  END IF;

  INSERT INTO resourcehub_private.booking_request_rate_limits (
    requester_user_id,
    recent_attempts
  )
  VALUES (v_actor, '{}')
  ON CONFLICT (requester_user_id) DO NOTHING;

  SELECT rate_limit.recent_attempts
  INTO v_recent_attempts
  FROM resourcehub_private.booking_request_rate_limits AS rate_limit
  WHERE rate_limit.requester_user_id = v_actor
  FOR UPDATE;

  v_now := pg_catalog.clock_timestamp();

  SELECT COALESCE(
    pg_catalog.array_agg(attempt.attempted_at ORDER BY attempt.attempted_at),
    ARRAY[]::timestamptz[]
  )
  INTO v_recent_attempts
  FROM pg_catalog.unnest(v_recent_attempts) AS attempt(attempted_at)
  WHERE attempt.attempted_at > v_now - interval '1 minute';

  IF pg_catalog.cardinality(v_recent_attempts) >= 10 THEN
    RAISE EXCEPTION 'Booking request rate limit exceeded.'
      USING errcode = 'P0001';
  END IF;

  v_recent_attempts := pg_catalog.array_append(v_recent_attempts, v_now);

  UPDATE resourcehub_private.booking_request_rate_limits
  SET recent_attempts = v_recent_attempts
  WHERE requester_user_id = v_actor;

  IF EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.resource_id = v_resource.id
      AND booking.status IN ('approved', 'in_use')
      AND pg_catalog.tstzrange(booking.starts_at, booking.ends_at, '[)')
        && pg_catalog.tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'This resource already has a confirmed booking for the requested time.'
      USING errcode = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.requester_user_id = v_actor
      AND booking.resource_id = v_resource.id
      AND booking.status IN ('pending', 'approved', 'in_use')
      AND pg_catalog.tstzrange(booking.starts_at, booking.ends_at, '[)')
        && pg_catalog.tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'You already have an overlapping booking for this resource.'
      USING errcode = '23P01';
  END IF;

  SELECT pg_catalog.count(*)
  INTO v_active_count
  FROM public.bookings AS booking
  WHERE booking.institution_id = v_resource.institution_id
    AND booking.requester_user_id = v_actor
    AND booking.status IN ('pending', 'approved', 'in_use');

  IF v_active_count >= v_max_active THEN
    RAISE EXCEPTION 'Active reservation limit reached.'
      USING errcode = 'P0001';
  END IF;

  SELECT pg_catalog.count(DISTINCT booking.resource_id)
  INTO v_overlapping_resource_count
  FROM public.bookings AS booking
  WHERE booking.institution_id = v_resource.institution_id
    AND booking.requester_user_id = v_actor
    AND booking.status IN ('pending', 'approved', 'in_use')
    AND pg_catalog.tstzrange(booking.starts_at, booking.ends_at, '[)')
      && pg_catalog.tstzrange(p_starts_at, p_ends_at, '[)');

  IF v_overlapping_resource_count >= v_max_concurrent THEN
    RAISE EXCEPTION 'Overlapping resource limit reached.'
      USING errcode = 'P0001';
  END IF;

  v_status := CASE
    WHEN v_resource.approval_mode = 'automatic' THEN 'approved'
    ELSE 'pending'
  END;

  v_now := pg_catalog.clock_timestamp();
  IF p_starts_at <= v_now THEN
    RAISE EXCEPTION 'Booking details are invalid.'
      USING errcode = '22023';
  END IF;

  INSERT INTO public.bookings (
    institution_id,
    resource_id,
    requester_membership_id,
    requester_user_id,
    starts_at,
    ends_at,
    purpose,
    status,
    reviewed_at,
    reviewed_by
  )
  VALUES (
    v_resource.institution_id,
    v_resource.id,
    v_membership_id,
    v_actor,
    p_starts_at,
    p_ends_at,
    pg_catalog.btrim(p_purpose),
    v_status,
    CASE WHEN v_status = 'approved' THEN v_now ELSE NULL END,
    CASE WHEN v_status = 'approved' THEN v_actor ELSE NULL END
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO resourcehub_private.booking_request_idempotency (
    requester_user_id,
    idempotency_key,
    resource_id,
    starts_at,
    ends_at,
    purpose,
    booking_id
  )
  VALUES (
    v_actor,
    p_idempotency_key,
    v_resource.id,
    p_starts_at,
    p_ends_at,
    pg_catalog.btrim(p_purpose),
    v_booking_id
  );

  INSERT INTO public.activity_events (
    institution_id, actor_id, resource_id, booking_id, event_type, summary
  )
  VALUES (
    v_resource.institution_id, v_actor, v_resource.id, v_booking_id,
    'booking_requested', 'A booking was requested.'
  )
  RETURNING id INTO v_event_id;

  IF v_status = 'pending' THEN
    INSERT INTO public.notifications (
      recipient_id, institution_id, activity_event_id, title, body
    )
    VALUES (
      v_resource.owner_user_id,
      v_resource.institution_id,
      v_event_id,
      'Booking request',
      'A resource booking is awaiting review.'
    );
  ELSE
    INSERT INTO public.notifications (
      recipient_id, institution_id, activity_event_id, title, body
    )
    VALUES (
      v_actor,
      v_resource.institution_id,
      v_event_id,
      'Booking confirmed',
      'Your booking was automatically confirmed.'
    );
  END IF;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION resourcehub_private.create_resource_booking(
  uuid, timestamptz, timestamptz, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_resource_booking(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_purpose text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN resourcehub_private.create_resource_booking(
    p_resource_id,
    p_starts_at,
    p_ends_at,
    p_purpose,
    pg_catalog.gen_random_uuid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_resource_booking(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_purpose text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN resourcehub_private.create_resource_booking(
    p_resource_id,
    p_starts_at,
    p_ends_at,
    p_purpose,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_resource_booking(
  uuid, timestamptz, timestamptz, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_resource_booking(
  uuid, timestamptz, timestamptz, text, uuid
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_resource_booking(
  uuid, timestamptz, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_resource_booking(
  uuid, timestamptz, timestamptz, text, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_resource_booking(
  p_booking_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_resource public.resources%rowtype;
  v_institution_active boolean;
  v_event_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING errcode = '42501';
  END IF;

  IF p_decision IS NULL
    OR p_decision NOT IN ('approved', 'rejected')
    OR (p_note IS NOT NULL AND pg_catalog.length(p_note) > 2000)
  THEN
    RAISE EXCEPTION 'Review details are invalid.'
      USING errcode = '22023';
  END IF;

  SELECT booking.*
  INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending bookings can be reviewed.'
      USING errcode = '55000';
  END IF;

  SELECT resource.*
  INTO v_resource
  FROM public.resources AS resource
  WHERE resource.id = v_booking.resource_id
  FOR SHARE;

  SELECT institution.is_active
  INTO v_institution_active
  FROM public.institutions AS institution
  WHERE institution.id = v_booking.institution_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Institution not found.'
      USING errcode = 'P0002';
  END IF;

  IF v_resource.owner_user_id <> v_actor
    OR NOT resourcehub_private.has_active_resource_role(
      v_resource.institution_id, 'resource_owner'
    )
  THEN
    RAISE EXCEPTION 'Active resource owner authorization required.'
      USING errcode = '42501';
  END IF;

  IF p_decision = 'approved'
    AND (NOT v_institution_active OR v_booking.starts_at <= pg_catalog.clock_timestamp())
  THEN
    RAISE EXCEPTION 'Booking start time has passed or the institution is inactive.'
      USING errcode = '55000';
  END IF;

  IF p_decision = 'approved' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'resource-booking:' || v_booking.resource_id::text,
        0
      )
    );

    IF EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.resource_id = v_booking.resource_id
        AND booking.id <> v_booking.id
        AND booking.status IN ('approved', 'in_use')
        AND pg_catalog.tstzrange(booking.starts_at, booking.ends_at, '[)')
          && pg_catalog.tstzrange(v_booking.starts_at, v_booking.ends_at, '[)')
    ) THEN
      RAISE EXCEPTION 'This resource already has a confirmed booking for the requested time.'
        USING errcode = '23P01';
    END IF;
  END IF;

  UPDATE public.bookings
  SET status = p_decision,
      decision_note = NULLIF(pg_catalog.btrim(p_note), ''),
      reviewed_by = v_actor,
      reviewed_at = pg_catalog.clock_timestamp()
  WHERE id = v_booking.id;

  INSERT INTO public.activity_events (
    institution_id, actor_id, resource_id, booking_id, event_type, summary
  )
  VALUES (
    v_booking.institution_id,
    v_actor,
    v_booking.resource_id,
    v_booking.id,
    CASE WHEN p_decision = 'approved' THEN 'booking_approved' ELSE 'booking_rejected' END,
    CASE WHEN p_decision = 'approved' THEN 'A booking was approved.' ELSE 'A booking was rejected.' END
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.notifications (
    recipient_id, institution_id, activity_event_id, title, body
  )
  VALUES (
    v_booking.requester_user_id,
    v_booking.institution_id,
    v_event_id,
    CASE WHEN p_decision = 'approved' THEN 'Booking approved' ELSE 'Booking declined' END,
    CASE WHEN p_decision = 'approved' THEN 'Your booking was approved.' ELSE 'Your booking was declined.' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_resource_booking(uuid, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.review_resource_booking(uuid, text, text)
  TO authenticated;
