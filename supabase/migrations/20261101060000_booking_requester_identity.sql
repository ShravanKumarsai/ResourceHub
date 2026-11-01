CREATE FUNCTION public.list_owned_booking_requesters(p_requester_user_ids uuid[])
RETURNS TABLE (
  requester_user_id uuid,
  requester_name text,
  requester_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    COALESCE(
      NULLIF(pg_catalog.btrim(profile.display_name), ''),
      NULLIF(pg_catalog.split_part(auth_user.email::text, '@', 1), ''),
      'Student'
    ),
    auth_user.email::text
  FROM public.profiles AS profile
  LEFT JOIN auth.users AS auth_user
    ON auth_user.id = profile.id
  WHERE profile.id = ANY(p_requester_user_ids)
    AND EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      JOIN public.resources AS resource
        ON resource.id = booking.resource_id
      WHERE booking.requester_user_id = profile.id
        AND resource.owner_user_id = v_actor_id
        AND resourcehub_private.has_active_resource_role(
          resource.institution_id,
          'resource_owner'
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.list_owned_booking_requesters(uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_owned_booking_requesters(uuid[])
  TO authenticated;

COMMENT ON FUNCTION public.list_owned_booking_requesters(uuid[]) IS
  'Returns requester names and email addresses only for users who booked resources owned by the caller as an active resource owner.';
