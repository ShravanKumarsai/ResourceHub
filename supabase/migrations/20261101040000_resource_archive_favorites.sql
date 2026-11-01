ALTER TABLE public.resources
  ADD COLUMN archived_at timestamptz;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_archived_must_be_unlisted
  CHECK (archived_at IS NULL OR NOT listed);

GRANT SELECT (archived_at) ON public.resources TO anon, authenticated;
REVOKE DELETE ON public.resources FROM PUBLIC, anon, authenticated, service_role;
DROP POLICY IF EXISTS "Active resource owners can delete their own resources"
  ON public.resources;

CREATE TABLE public.resource_favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX resource_favorites_resource_id_idx
  ON public.resource_favorites (resource_id);

ALTER TABLE public.resource_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resource_favorites
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.resource_favorites TO authenticated;

CREATE POLICY "Users can read their own resource favorites"
ON public.resource_favorites
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can favorite listed resources"
ON public.resource_favorites
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.resources AS resource
    JOIN public.institutions AS institution
      ON institution.id = resource.institution_id
    WHERE resource.id = resource_favorites.resource_id
      AND resource.listed
      AND resource.archived_at IS NULL
      AND institution.is_active
  )
);

CREATE POLICY "Users can remove their own resource favorites"
ON public.resource_favorites
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION resourcehub_private.guard_resource_archival()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
    AND auth.uid() IS NOT NULL
    AND (
      NEW.owner_user_id IS DISTINCT FROM auth.uid()
      OR NOT resourcehub_private.has_active_resource_role(
        NEW.institution_id,
        'resource_owner'
      )
    )
  THEN
    RAISE EXCEPTION 'Active resource owner authorization required.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.resource_id = OLD.id
        AND booking.status IN ('pending', 'approved', 'in_use')
    ) THEN
      RAISE EXCEPTION 'Resource has active bookings and cannot be archived.'
        USING ERRCODE = '23514';
    END IF;

    NEW.listed := false;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION resourcehub_private.guard_resource_archival()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER resources_guard_archival
BEFORE UPDATE OF archived_at ON public.resources
FOR EACH ROW
EXECUTE FUNCTION resourcehub_private.guard_resource_archival();

CREATE OR REPLACE FUNCTION resourcehub_private.record_resource_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.activity_events (
    institution_id, actor_id, resource_id, event_type, summary
  )
  VALUES (
    NEW.institution_id,
    auth.uid(),
    NEW.id,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'resource_created'
      WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'resource_archived'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'resource_restored'
      ELSE 'resource_updated'
    END,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'Resource listing created.'
      WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'Resource archived.'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'Resource restored as a draft.'
      ELSE 'Resource listing updated.'
    END
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION resourcehub_private.guard_booking_for_archived_resource()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_archived_at timestamptz;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'resource-retirement:' || NEW.resource_id::text,
      0
    )
  );

  SELECT resource.archived_at
  INTO v_archived_at
  FROM public.resources AS resource
  WHERE resource.id = NEW.resource_id
  FOR SHARE;

  IF NOT FOUND OR v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Resource is unavailable.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION resourcehub_private.guard_booking_for_archived_resource()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER bookings_guard_archived_resource
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION resourcehub_private.guard_booking_for_archived_resource();

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_resource_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'resource-retirement:' || p_resource_id::text,
        0
      )
    );
  END IF;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_resource_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'resource-retirement:' || p_resource_id::text,
        0
      )
    );
  END IF;

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

CREATE FUNCTION public.archive_resource(p_resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_resource public.resources%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_resource_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found or you do not own it.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'resource-retirement:' || p_resource_id::text,
      0
    )
  );

  SELECT resource.*
  INTO v_resource
  FROM public.resources AS resource
  WHERE resource.id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND OR v_resource.owner_user_id IS DISTINCT FROM v_actor
    OR NOT resourcehub_private.has_active_resource_role(
      v_resource.institution_id,
      'resource_owner'
    )
  THEN
    RAISE EXCEPTION 'Resource not found or you do not own it.'
      USING ERRCODE = '42501';
  END IF;

  IF v_resource.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Resource is already archived.'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.resource_id = p_resource_id
      AND booking.status IN ('pending', 'approved', 'in_use')
  ) THEN
    RAISE EXCEPTION 'Resource has active bookings and cannot be archived.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.resources
  SET archived_at = pg_catalog.clock_timestamp(),
      listed = false
  WHERE id = p_resource_id;
END;
$$;

CREATE FUNCTION public.restore_resource(p_resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_resource public.resources%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_resource_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found or you do not own it.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'resource-retirement:' || p_resource_id::text,
      0
    )
  );

  SELECT resource.*
  INTO v_resource
  FROM public.resources AS resource
  WHERE resource.id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND OR v_resource.owner_user_id IS DISTINCT FROM v_actor
    OR NOT resourcehub_private.has_active_resource_role(
      v_resource.institution_id,
      'resource_owner'
    )
  THEN
    RAISE EXCEPTION 'Resource not found or you do not own it.'
      USING ERRCODE = '42501';
  END IF;

  IF v_resource.archived_at IS NULL THEN
    RAISE EXCEPTION 'Resource is not archived.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.resources
  SET archived_at = NULL,
      listed = false
  WHERE id = p_resource_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_resource(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.restore_resource(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.archive_resource(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_resource(uuid)
  TO authenticated;
