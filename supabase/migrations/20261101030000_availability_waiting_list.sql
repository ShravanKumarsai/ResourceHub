CREATE OR REPLACE FUNCTION public.get_resource_booking_availability(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS TABLE (
  resource_available boolean,
  has_confirmed_conflict boolean,
  has_pending_conflict boolean,
  already_on_waiting_list boolean,
  can_join_waiting_list boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_resource public.resources%rowtype;
  v_confirmed_conflict boolean := false;
  v_pending_conflict boolean := false;
  v_already_waiting boolean := false;
  v_active_student boolean := false;
BEGIN
  IF p_resource_id IS NULL
    OR p_starts_at IS NULL
    OR p_ends_at IS NULL
    OR p_ends_at <= p_starts_at
    OR p_starts_at <= pg_catalog.clock_timestamp()
  THEN
    RAISE EXCEPTION 'The requested time range is invalid.'
      USING errcode = '22023';
  END IF;

  SELECT resource.*
  INTO v_resource
  FROM public.resources AS resource
  JOIN public.institutions AS institution
    ON institution.id = resource.institution_id
  WHERE resource.id = p_resource_id
    AND resource.listed
    AND institution.is_active;

  IF NOT FOUND OR v_resource.availability = 'unavailable' THEN
    RETURN QUERY SELECT false, false, false, false, false;
    RETURN;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING errcode = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.institution_memberships AS membership
    JOIN public.institution_membership_roles AS membership_role
      ON membership_role.membership_id = membership.id
    WHERE membership.institution_id = v_resource.institution_id
      AND membership.user_id = v_actor
      AND membership.status = 'active'
      AND membership_role.role = 'student'
  )
  INTO v_active_student;

  IF NOT v_active_student THEN
    RAISE EXCEPTION 'Active student membership required.'
      USING errcode = '42501';
  END IF;

  IF EXTRACT(epoch FROM (p_ends_at - p_starts_at)) / 3600
    > v_resource.max_duration_hours
  THEN
    RAISE EXCEPTION 'Requested duration exceeds this resource limit.'
      USING errcode = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.resource_id = v_resource.id
      AND booking.status IN ('approved', 'in_use')
      AND pg_catalog.tstzrange(booking.starts_at, booking.ends_at, '[)')
        && pg_catalog.tstzrange(p_starts_at, p_ends_at, '[)')
  )
  INTO v_confirmed_conflict;

  SELECT EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.resource_id = v_resource.id
      AND booking.status = 'pending'
      AND pg_catalog.tstzrange(booking.starts_at, booking.ends_at, '[)')
        && pg_catalog.tstzrange(p_starts_at, p_ends_at, '[)')
  )
  INTO v_pending_conflict;

  SELECT EXISTS (
    SELECT 1
    FROM public.waiting_list_entries AS entry
    WHERE entry.resource_id = v_resource.id
      AND entry.requester_user_id = v_actor
      AND entry.starts_at = p_starts_at
      AND entry.ends_at = p_ends_at
      AND entry.status IN ('waiting', 'offered', 'accepted')
  )
  INTO v_already_waiting;

  RETURN QUERY
  SELECT
    true,
    v_confirmed_conflict,
    v_pending_conflict,
    v_already_waiting,
    v_confirmed_conflict AND v_active_student AND NOT v_already_waiting;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_resource_waiting_list(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_resource public.resources%rowtype;
  v_membership_id uuid;
  v_entry_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING errcode = '42501';
  END IF;

  IF p_resource_id IS NULL
    OR p_starts_at IS NULL
    OR p_ends_at IS NULL
    OR p_ends_at <= p_starts_at
    OR p_starts_at <= pg_catalog.clock_timestamp()
  THEN
    RAISE EXCEPTION 'Waiting-list time range is invalid.'
      USING errcode = '22023';
  END IF;

  SELECT resource.*
  INTO v_resource
  FROM public.resources AS resource
  JOIN public.institutions AS institution
    ON institution.id = resource.institution_id
  WHERE resource.id = p_resource_id
    AND resource.listed
    AND institution.is_active;

  IF NOT FOUND OR v_resource.availability = 'unavailable' THEN
    RAISE EXCEPTION 'Resource is unavailable.'
      USING errcode = 'P0002';
  END IF;

  IF EXTRACT(epoch FROM (p_ends_at - p_starts_at)) / 3600
    > v_resource.max_duration_hours
  THEN
    RAISE EXCEPTION 'Requested duration exceeds this resource limit.'
      USING errcode = '22023';
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.resource_id = v_resource.id
      AND booking.status IN ('approved', 'in_use')
      AND pg_catalog.tstzrange(booking.starts_at, booking.ends_at, '[)')
        && pg_catalog.tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'The requested time is not blocked by a confirmed booking.'
      USING errcode = '22023';
  END IF;

  INSERT INTO public.waiting_list_entries (
    institution_id,
    resource_id,
    requester_membership_id,
    requester_user_id,
    starts_at,
    ends_at
  )
  VALUES (
    v_resource.institution_id,
    v_resource.id,
    v_membership_id,
    v_actor,
    p_starts_at,
    p_ends_at
  )
  ON CONFLICT (resource_id, requester_user_id, starts_at, ends_at)
    WHERE status IN ('waiting', 'offered', 'accepted')
  DO NOTHING
  RETURNING id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Already joined this waiting list.'
      USING errcode = '23505';
  END IF;

  INSERT INTO public.activity_events (
    institution_id, actor_id, resource_id, event_type, summary
  )
  VALUES (
    v_resource.institution_id,
    v_actor,
    v_resource.id,
    'waiting_list_joined',
    'A user joined a resource waiting list.'
  );

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_resource_waiting_list()
RETURNS TABLE (
  entry_id uuid,
  resource_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz,
  queue_position bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    queued.id,
    queued.resource_id,
    queued.starts_at,
    queued.ends_at,
    queued.created_at,
    queued.queue_position
  FROM (
    SELECT
      entry.id,
      entry.resource_id,
      entry.requester_user_id,
      entry.starts_at,
      entry.ends_at,
      entry.created_at,
      pg_catalog.row_number() OVER (
        PARTITION BY entry.resource_id, entry.starts_at, entry.ends_at
        ORDER BY entry.created_at, entry.id
      ) AS queue_position
    FROM public.waiting_list_entries AS entry
    JOIN public.resources AS resource
      ON resource.id = entry.resource_id
      AND resource.institution_id = entry.institution_id
    JOIN public.institutions AS institution
      ON institution.id = entry.institution_id
      AND institution.is_active
    JOIN public.institution_memberships AS membership
      ON membership.id = entry.requester_membership_id
      AND membership.institution_id = entry.institution_id
      AND membership.user_id = entry.requester_user_id
      AND membership.status = 'active'
    JOIN public.institution_membership_roles AS membership_role
      ON membership_role.membership_id = membership.id
      AND membership_role.role = 'student'
    WHERE entry.status = 'waiting'
      AND resource.listed
      AND resource.availability <> 'unavailable'
  ) AS queued
  WHERE queued.requester_user_id = auth.uid()
  ORDER BY queued.starts_at, queued.created_at, queued.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_resource_waiting_list(
  p_entry_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_entry public.waiting_list_entries%rowtype;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING errcode = '42501';
  END IF;

  SELECT entry.*
  INTO v_entry
  FROM public.waiting_list_entries AS entry
  WHERE entry.id = p_entry_id
    AND entry.requester_user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waiting-list entry not found.'
      USING errcode = 'P0002';
  END IF;

  IF v_entry.status <> 'waiting' THEN
    RAISE EXCEPTION 'Only active waiting-list entries can be cancelled.'
      USING errcode = '55000';
  END IF;

  UPDATE public.waiting_list_entries
  SET status = 'cancelled'
  WHERE id = v_entry.id;

  INSERT INTO public.activity_events (
    institution_id, actor_id, resource_id, event_type, summary
  )
  VALUES (
    v_entry.institution_id,
    v_actor,
    v_entry.resource_id,
    'waiting_list_cancelled',
    'A user left a resource waiting list.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_resource_booking_availability(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.join_resource_waiting_list(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.list_my_resource_waiting_list()
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.cancel_resource_waiting_list(uuid)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.get_resource_booking_availability(uuid, timestamptz, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_resource_waiting_list(uuid, timestamptz, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_resource_waiting_list()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_resource_waiting_list(uuid)
  TO authenticated;
