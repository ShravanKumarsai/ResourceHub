CREATE TABLE resourcehub_private.institution_accountability_settings (
  institution_id uuid PRIMARY KEY
    REFERENCES public.institutions(id) ON DELETE CASCADE,
  late_flag_threshold integer NOT NULL DEFAULT 5
    CHECK (late_flag_threshold BETWEEN 1 AND 100),
  max_usage_duration_minutes integer
    CHECK (
      max_usage_duration_minutes IS NULL
      OR max_usage_duration_minutes BETWEEN 1 AND 10080
    ),
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE resourcehub_private.institution_accountability_settings
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON resourcehub_private.institution_accountability_settings
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.condition_reports
  ADD COLUMN evidence_paths text[] NOT NULL DEFAULT '{}'
    CHECK (pg_catalog.cardinality(evidence_paths) <= 8);

ALTER TABLE public.notifications
  ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  ADD COLUMN dedupe_key text
    CHECK (dedupe_key IS NULL OR length(dedupe_key) BETWEEN 1 AND 160);

CREATE UNIQUE INDEX notifications_dedupe_key_idx
  ON public.notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.incidents
  ADD COLUMN evidence_paths text[] NOT NULL DEFAULT '{}'
    CHECK (pg_catalog.cardinality(evidence_paths) <= 8);

CREATE TABLE resourcehub_private.incident_report_requests (
  reporter_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  request_payload jsonb NOT NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (reporter_user_id, idempotency_key)
);

ALTER TABLE resourcehub_private.incident_report_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON resourcehub_private.incident_report_requests
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.handover_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE
    REFERENCES public.bookings(id) ON DELETE RESTRICT,
  institution_id uuid NOT NULL
    REFERENCES public.institutions(id) ON DELETE RESTRICT,
  resource_id uuid NOT NULL,
  student_user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  check_out_report_id uuid NOT NULL REFERENCES public.condition_reports(id) ON DELETE RESTRICT,
  check_in_report_id uuid REFERENCES public.condition_reports(id) ON DELETE RESTRICT,
  checked_out_at timestamptz NOT NULL,
  checked_in_at timestamptz,
  check_in_deadline timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  returned_on_time boolean,
  student_comments text NOT NULL DEFAULT '' CHECK (length(student_comments) <= 2000),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  FOREIGN KEY (resource_id, institution_id)
    REFERENCES public.resources(id, institution_id) ON DELETE RESTRICT,
  FOREIGN KEY (booking_id, resource_id, institution_id)
    REFERENCES public.bookings(id, resource_id, institution_id) ON DELETE RESTRICT,
  CHECK (checked_in_at IS NULL OR checked_in_at >= checked_out_at),
  CHECK (
    (checked_in_at IS NULL AND check_in_report_id IS NULL AND returned_on_time IS NULL)
    OR
    (checked_in_at IS NOT NULL AND check_in_report_id IS NOT NULL AND returned_on_time IS NOT NULL)
  )
);

CREATE INDEX handover_records_manager_history_idx
  ON public.handover_records (institution_id, resource_id, checked_out_at DESC, id DESC);
CREATE INDEX handover_records_student_history_idx
  ON public.handover_records (student_user_id, checked_out_at DESC, id DESC);
CREATE INDEX handover_records_deadline_idx
  ON public.handover_records (check_in_deadline, booking_id)
  WHERE checked_in_at IS NULL;

CREATE TABLE public.late_return_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE
    REFERENCES public.bookings(id) ON DELETE RESTRICT,
  institution_id uuid NOT NULL
    REFERENCES public.institutions(id) ON DELETE RESTRICT,
  resource_id uuid NOT NULL,
  student_user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  scheduled_deadline timestamptz NOT NULL,
  flagged_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  detected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (resource_id, institution_id)
    REFERENCES public.resources(id, institution_id) ON DELETE RESTRICT,
  FOREIGN KEY (booking_id, resource_id, institution_id)
    REFERENCES public.bookings(id, resource_id, institution_id) ON DELETE RESTRICT
);

CREATE INDEX late_return_flags_student_idx
  ON public.late_return_flags (institution_id, student_user_id, flagged_at DESC);
CREATE INDEX late_return_flags_manager_idx
  ON public.late_return_flags (resource_id, flagged_at DESC);

ALTER TABLE public.handover_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_return_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.handover_records, public.late_return_flags
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.handover_records, public.late_return_flags TO authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'handover-evidence',
  'handover-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Students can upload evidence for their active handovers"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'handover-evidence'
  AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(check_out|check_in)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,180}$'
  AND EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    JOIN public.institution_memberships AS membership
      ON membership.institution_id = booking.institution_id
      AND membership.user_id = booking.requester_user_id
      AND membership.status = 'active'
    WHERE booking.id = (pg_catalog.split_part(name, '/', 2))::uuid
      AND booking.institution_id = (pg_catalog.split_part(name, '/', 1))::uuid
      AND booking.requester_user_id = (SELECT auth.uid())
      AND pg_catalog.split_part(name, '/', 4) = (SELECT auth.uid())::text
      AND resourcehub_private.has_active_resource_role(
        booking.institution_id,
        'student'
      )
      AND (
        (pg_catalog.split_part(name, '/', 3) = 'check_out' AND booking.status = 'approved')
        OR
        (pg_catalog.split_part(name, '/', 3) = 'check_in' AND booking.status = 'in_use')
      )
  )
);

CREATE POLICY "Students and managers can view handover evidence"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'handover-evidence'
  AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(check_out|check_in)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,180}$'
  AND EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    JOIN public.resources AS resource ON resource.id = booking.resource_id
    WHERE booking.id = (pg_catalog.split_part(name, '/', 2))::uuid
      AND booking.institution_id = (pg_catalog.split_part(name, '/', 1))::uuid
      AND (
        booking.requester_user_id = (SELECT auth.uid())
        OR (
          resource.owner_user_id = (SELECT auth.uid())
          AND resourcehub_private.has_active_resource_role(
            resource.institution_id,
            'resource_owner'
          )
        )
        OR resourcehub_private.has_active_resource_role(
          booking.institution_id,
          'institution_admin'
        )
      )
  )
);

CREATE POLICY "Students can remove their own unused handover evidence"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'handover-evidence'
  AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(check_out|check_in)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,180}$'
  AND pg_catalog.split_part(name, '/', 4) = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.bookings AS booking
    WHERE booking.id = (pg_catalog.split_part(name, '/', 2))::uuid
      AND booking.requester_user_id = (SELECT auth.uid())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.condition_reports AS report
    WHERE name = ANY (report.evidence_paths)
  )
);

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'incident-evidence',
  'incident-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Reporters can upload incident evidence"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'incident-evidence'
  AND objects.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(none|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-7]\.(jpg|png|webp|pdf)$'
  AND pg_catalog.split_part(objects.name, '/', 4) = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.resources AS resource
    WHERE resource.id = pg_catalog.split_part(objects.name, '/', 2)::uuid
      AND resource.institution_id = pg_catalog.split_part(objects.name, '/', 1)::uuid
      AND (
        (
          resource.owner_user_id = (SELECT auth.uid())
          AND resourcehub_private.has_active_resource_role(
            resource.institution_id,
            'resource_owner'
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.bookings AS booking
          JOIN public.institution_memberships AS membership
            ON membership.id = booking.requester_membership_id
            AND membership.user_id = booking.requester_user_id
            AND membership.status = 'active'
          WHERE booking.id = NULLIF(
              pg_catalog.split_part(objects.name, '/', 3),
              'none'
            )::uuid
            AND booking.resource_id = resource.id
            AND booking.institution_id = resource.institution_id
            AND booking.requester_user_id = (SELECT auth.uid())
            AND pg_catalog.split_part(objects.name, '/', 3) <> 'none'
            AND resourcehub_private.has_active_resource_role(
              resource.institution_id,
              'student'
            )
        )
      )
  )
);

CREATE POLICY "Incident participants and managers can view evidence"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'incident-evidence'
  AND objects.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(none|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-7]\.(jpg|png|webp|pdf)$'
  AND (
    pg_catalog.split_part(objects.name, '/', 4) = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1
      FROM public.resources AS resource
      WHERE resource.id = pg_catalog.split_part(objects.name, '/', 2)::uuid
        AND resource.institution_id = pg_catalog.split_part(objects.name, '/', 1)::uuid
        AND (
          (
            resource.owner_user_id = (SELECT auth.uid())
            AND resourcehub_private.has_active_resource_role(
              resource.institution_id,
              'resource_owner'
            )
          )
          OR resourcehub_private.has_active_resource_role(
            resource.institution_id,
            'institution_admin'
          )
        )
    )
  )
);

CREATE POLICY "Reporters can replace unused incident evidence"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'incident-evidence'
  AND pg_catalog.split_part(objects.name, '/', 4) = (SELECT auth.uid())::text
  AND NOT EXISTS (
    SELECT 1 FROM public.incidents AS incident
    WHERE objects.name = ANY (incident.evidence_paths)
  )
)
WITH CHECK (
  bucket_id = 'incident-evidence'
  AND objects.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(none|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-7]\.(jpg|png|webp|pdf)$'
  AND pg_catalog.split_part(objects.name, '/', 4) = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.resources AS resource
    WHERE resource.id = pg_catalog.split_part(objects.name, '/', 2)::uuid
      AND resource.institution_id = pg_catalog.split_part(objects.name, '/', 1)::uuid
      AND (
        (
          resource.owner_user_id = (SELECT auth.uid())
          AND resourcehub_private.has_active_resource_role(
            resource.institution_id,
            'resource_owner'
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.bookings AS booking
          JOIN public.institution_memberships AS membership
            ON membership.id = booking.requester_membership_id
            AND membership.user_id = booking.requester_user_id
            AND membership.status = 'active'
          WHERE booking.id = NULLIF(
              pg_catalog.split_part(objects.name, '/', 3),
              'none'
            )::uuid
            AND booking.resource_id = resource.id
            AND booking.institution_id = resource.institution_id
            AND booking.requester_user_id = (SELECT auth.uid())
            AND pg_catalog.split_part(objects.name, '/', 3) <> 'none'
            AND resourcehub_private.has_active_resource_role(
              resource.institution_id,
              'student'
            )
        )
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.incidents AS incident
    WHERE objects.name = ANY (incident.evidence_paths)
  )
);

CREATE POLICY "Reporters can remove unused incident evidence"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'incident-evidence'
  AND pg_catalog.split_part(objects.name, '/', 4) = (SELECT auth.uid())::text
  AND NOT EXISTS (
    SELECT 1 FROM public.incidents AS incident
    WHERE objects.name = ANY (incident.evidence_paths)
  )
);

CREATE POLICY "Participants and resource managers can read handovers"
ON public.handover_records
FOR SELECT TO authenticated
USING (
  student_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.resources AS resource
    WHERE resource.id = handover_records.resource_id
      AND resource.owner_user_id = (SELECT auth.uid())
      AND resourcehub_private.has_active_resource_role(
        resource.institution_id,
        'resource_owner'
      )
  )
  OR resourcehub_private.has_active_resource_role(
    handover_records.institution_id,
    'institution_admin'
  )
);

CREATE POLICY "Flagged students and authorised managers can read late flags"
ON public.late_return_flags
FOR SELECT TO authenticated
USING (
  student_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.resources AS resource
    WHERE resource.id = late_return_flags.resource_id
      AND resource.owner_user_id = (SELECT auth.uid())
      AND resourcehub_private.has_active_resource_role(
        resource.institution_id,
        'resource_owner'
      )
  )
  OR resourcehub_private.has_active_resource_role(
    late_return_flags.institution_id,
    'institution_admin'
  )
);

CREATE OR REPLACE FUNCTION public.set_institution_accountability_settings(
  p_institution_id uuid,
  p_late_flag_threshold integer,
  p_max_usage_duration_minutes integer,
  p_timezone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING errcode = '42501';
  END IF;

  IF p_late_flag_threshold IS NULL
    OR p_late_flag_threshold NOT BETWEEN 1 AND 100
    OR (
      p_max_usage_duration_minutes IS NOT NULL
      AND p_max_usage_duration_minutes NOT BETWEEN 1 AND 10080
    )
    OR p_timezone IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names AS timezone
      WHERE timezone.name = p_timezone
    )
  THEN
    RAISE EXCEPTION 'Accountability settings are invalid.'
      USING errcode = '22023';
  END IF;

  IF NOT resourcehub_private.is_institution_admin(p_institution_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.institutions AS institution
      WHERE institution.id = p_institution_id AND institution.is_active
    )
  THEN
    RAISE EXCEPTION 'An active institution administrator is required.'
      USING errcode = '42501';
  END IF;

  INSERT INTO resourcehub_private.institution_accountability_settings (
    institution_id,
    late_flag_threshold,
    max_usage_duration_minutes,
    timezone,
    updated_at
  )
  VALUES (
    p_institution_id,
    p_late_flag_threshold,
    p_max_usage_duration_minutes,
    p_timezone,
    pg_catalog.clock_timestamp()
  )
  ON CONFLICT (institution_id) DO UPDATE
  SET late_flag_threshold = EXCLUDED.late_flag_threshold,
      max_usage_duration_minutes = EXCLUDED.max_usage_duration_minutes,
      timezone = EXCLUDED.timezone,
      updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_institution_accountability_settings(
  p_institution_id uuid
)
RETURNS TABLE (
  late_flag_threshold integer,
  max_usage_duration_minutes integer,
  timezone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT resourcehub_private.is_institution_admin(p_institution_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.institutions AS institution
      WHERE institution.id = p_institution_id AND institution.is_active
    )
  THEN
    RAISE EXCEPTION 'An active institution administrator is required.'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT COALESCE(settings.late_flag_threshold, 5),
         settings.max_usage_duration_minutes,
         COALESCE(settings.timezone, 'UTC')
  FROM public.institutions AS institution
  LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
    ON settings.institution_id = institution.id
  WHERE institution.id = p_institution_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_institution_accountability_settings(uuid, integer, integer, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_institution_accountability_settings(uuid, integer, integer, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.get_institution_accountability_settings(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_institution_accountability_settings(uuid)
  TO authenticated;

CREATE FUNCTION public.get_owned_student_late_flag_counts(p_student_user_ids uuid[])
RETURNS TABLE (
  institution_id uuid,
  student_user_id uuid,
  late_flag_count bigint,
  late_flag_threshold integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR p_student_user_ids IS NULL
    OR pg_catalog.cardinality(p_student_user_ids) > 100
  THEN
    RAISE EXCEPTION 'A valid set of students is required.'
      USING errcode = '22023';
  END IF;

  RETURN QUERY
  WITH managed_students AS (
    SELECT DISTINCT handover.institution_id, handover.student_user_id
    FROM public.handover_records AS handover
    JOIN public.resources AS resource
      ON resource.id = handover.resource_id
      AND resource.owner_user_id = auth.uid()
    WHERE handover.student_user_id = ANY (p_student_user_ids)
      AND resourcehub_private.has_active_resource_role(
        handover.institution_id,
        'resource_owner'
      )
  )
  SELECT managed.institution_id,
         managed.student_user_id,
         COUNT(flag.id),
         COALESCE(settings.late_flag_threshold, 5)
  FROM managed_students AS managed
  LEFT JOIN public.late_return_flags AS flag
    ON flag.institution_id = managed.institution_id
    AND flag.student_user_id = managed.student_user_id
  LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
    ON settings.institution_id = managed.institution_id
  GROUP BY managed.institution_id, managed.student_user_id,
           settings.late_flag_threshold;
END;
$$;

REVOKE ALL ON FUNCTION public.get_owned_student_late_flag_counts(uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_owned_student_late_flag_counts(uuid[])
  TO authenticated;

CREATE FUNCTION public.get_institution_member_late_flag_counts(
  p_institution_id uuid,
  p_membership_ids uuid[]
)
RETURNS TABLE (
  membership_id uuid,
  late_flag_count bigint,
  late_flag_threshold integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR p_institution_id IS NULL
    OR p_membership_ids IS NULL
    OR pg_catalog.cardinality(p_membership_ids) > 100
  THEN
    RAISE EXCEPTION 'A valid set of institution memberships is required.'
      USING errcode = '22023';
  END IF;

  IF NOT resourcehub_private.is_institution_admin(p_institution_id)
  THEN
    RAISE EXCEPTION 'An active institution administrator is required.'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT membership.id,
         COUNT(flag.id),
         COALESCE(settings.late_flag_threshold, 5)
  FROM public.institution_memberships AS membership
  JOIN public.institution_membership_roles AS membership_role
    ON membership_role.membership_id = membership.id
    AND membership_role.role = 'student'
  LEFT JOIN public.late_return_flags AS flag
    ON flag.institution_id = membership.institution_id
    AND flag.student_user_id = membership.user_id
  LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
    ON settings.institution_id = membership.institution_id
  WHERE membership.id = ANY (p_membership_ids)
    AND membership.institution_id = p_institution_id
    AND membership.status = 'active'
  GROUP BY membership.id, settings.late_flag_threshold;
END;
$$;

REVOKE ALL ON FUNCTION public.get_institution_member_late_flag_counts(uuid, uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_institution_member_late_flag_counts(uuid, uuid[])
  TO authenticated;

CREATE FUNCTION public.get_my_late_return_summary()
RETURNS TABLE (
  institution_id uuid,
  institution_name text,
  late_flag_count bigint,
  late_flag_threshold integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT institution.id,
         institution.name,
         COUNT(DISTINCT flag.id),
         COALESCE(settings.late_flag_threshold, 5)
  FROM public.institutions AS institution
  JOIN public.institution_memberships AS membership
    ON membership.institution_id = institution.id
    AND membership.user_id = v_actor
    AND membership.status = 'active'
  JOIN public.institution_membership_roles AS membership_role
    ON membership_role.membership_id = membership.id
    AND membership_role.role = 'student'
  LEFT JOIN public.late_return_flags AS flag
    ON flag.institution_id = institution.id
    AND flag.student_user_id = v_actor
  LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
    ON settings.institution_id = institution.id
  WHERE institution.is_active
  GROUP BY institution.id, institution.name, settings.late_flag_threshold;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_late_return_summary()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_late_return_summary()
  TO authenticated;

CREATE FUNCTION public.report_resource_incident_with_evidence(
  p_resource_id uuid,
  p_booking_id uuid,
  p_severity text,
  p_title text,
  p_description text,
  p_evidence_paths text[],
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_institution_id uuid;
  v_payload jsonb;
  v_is_new boolean;
  v_incident_id uuid;
  v_existing resourcehub_private.incident_report_requests%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING errcode = '42501';
  END IF;
  IF p_idempotency_key IS NULL
    OR p_evidence_paths IS NULL
    OR pg_catalog.cardinality(p_evidence_paths) > 8
    OR pg_catalog.cardinality(p_evidence_paths) <>
      (SELECT COUNT(DISTINCT path)::integer
       FROM pg_catalog.unnest(p_evidence_paths) AS evidence(path))
  THEN
    RAISE EXCEPTION 'Incident evidence or idempotency key is invalid.'
      USING errcode = '22023';
  END IF;

  SELECT resource.institution_id INTO v_institution_id
  FROM public.resources AS resource
  WHERE resource.id = p_resource_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource not found.' USING errcode = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(p_evidence_paths) AS evidence(path)
    WHERE evidence.path !~ (
      '^' || v_institution_id::text || '/' || p_resource_id::text || '/'
      || COALESCE(p_booking_id::text, 'none') || '/' || v_actor::text || '/'
      || p_idempotency_key::text || '/[0-7]\.(jpg|png|webp|pdf)$'
    )
      OR NOT EXISTS (
        SELECT 1 FROM storage.objects AS object
        WHERE object.bucket_id = 'incident-evidence'
          AND object.name = evidence.path
      )
  ) THEN
    RAISE EXCEPTION 'Incident evidence is invalid or unavailable.'
      USING errcode = '22023';
  END IF;

  v_payload := pg_catalog.jsonb_build_object(
    'resourceId', p_resource_id,
    'bookingId', p_booking_id,
    'severity', p_severity,
    'title', pg_catalog.btrim(p_title),
    'description', pg_catalog.btrim(p_description),
    'evidencePaths', p_evidence_paths
  );

  INSERT INTO resourcehub_private.incident_report_requests (
    reporter_user_id,
    idempotency_key,
    request_payload
  )
  VALUES (v_actor, p_idempotency_key, v_payload)
  ON CONFLICT (reporter_user_id, idempotency_key) DO NOTHING
  RETURNING true INTO v_is_new;

  IF NOT COALESCE(v_is_new, false) THEN
    SELECT request.* INTO STRICT v_existing
    FROM resourcehub_private.incident_report_requests AS request
    WHERE request.reporter_user_id = v_actor
      AND request.idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF v_existing.request_payload <> v_payload THEN
      RAISE EXCEPTION 'This incident submission key was already used for different details.'
        USING errcode = '23505';
    END IF;
    IF v_existing.incident_id IS NULL THEN
      RAISE EXCEPTION 'This incident submission is still being processed.'
        USING errcode = '55000';
    END IF;
    RETURN v_existing.incident_id;
  END IF;

  v_incident_id := public.report_resource_incident(
    p_resource_id,
    p_booking_id,
    p_severity,
    p_title,
    p_description
  );

  UPDATE public.incidents
  SET evidence_paths = p_evidence_paths
  WHERE id = v_incident_id
    AND reporter_user_id = v_actor;

  UPDATE resourcehub_private.incident_report_requests
  SET incident_id = v_incident_id
  WHERE reporter_user_id = v_actor
    AND idempotency_key = p_idempotency_key;

  RETURN v_incident_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_resource_incident_with_evidence(
  uuid, uuid, text, text, text, text[], uuid
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.report_resource_incident_with_evidence(
  uuid, uuid, text, text, text, text[], uuid
) TO authenticated;
REVOKE ALL ON FUNCTION public.report_resource_incident(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION resourcehub_private.create_late_return_flag(
  p_booking_id uuid,
  p_detected_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_handover public.handover_records%ROWTYPE;
  v_resource public.resources%ROWTYPE;
  v_student_name text;
  v_previous_flags integer;
  v_flag_id uuid;
  v_notification_details jsonb;
  v_timezone text;
BEGIN
  SELECT booking.* INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND OR v_booking.status NOT IN ('in_use', 'completed') THEN
    RETURN false;
  END IF;

  SELECT handover.* INTO v_handover
  FROM public.handover_records AS handover
  WHERE handover.booking_id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT resource.* INTO v_resource
  FROM public.resources AS resource
  WHERE resource.id = v_booking.resource_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The resource for this booking could not be found.';
  END IF;

  SELECT COALESCE(settings.timezone, 'UTC')
  INTO v_timezone
  FROM public.institutions AS institution
  LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
    ON settings.institution_id = institution.id
  WHERE institution.id = v_booking.institution_id;

  IF v_handover.checked_in_at IS NOT NULL
    AND v_handover.checked_in_at <= v_handover.check_in_deadline
  THEN
    RETURN false;
  END IF;
  IF v_handover.checked_in_at IS NULL
    AND (
      v_booking.status <> 'in_use'
      OR v_handover.check_in_deadline >= pg_catalog.clock_timestamp()
    )
  THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::integer INTO v_previous_flags
  FROM public.late_return_flags AS flag
  WHERE flag.institution_id = v_booking.institution_id
    AND flag.student_user_id = v_booking.requester_user_id;

  INSERT INTO public.late_return_flags (
    booking_id,
    institution_id,
    resource_id,
    student_user_id,
    scheduled_deadline,
    detected_by
  )
  VALUES (
    v_booking.id,
    v_booking.institution_id,
    v_booking.resource_id,
    v_booking.requester_user_id,
    v_handover.check_in_deadline,
    p_detected_by
  )
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING id INTO v_flag_id;

  IF v_flag_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(NULLIF(pg_catalog.btrim(profile.display_name), ''), 'Student')
  INTO v_student_name
  FROM public.profiles AS profile
  WHERE profile.id = v_booking.requester_user_id;
  v_student_name := COALESCE(v_student_name, 'Student');

  v_notification_details := pg_catalog.jsonb_build_object(
    'type', 'late_return',
    'flagId', v_flag_id,
    'studentName', v_student_name,
    'studentId', v_booking.requester_user_id,
    'resourceName', v_resource.name,
    'resourceId', v_resource.id,
    'bookingId', v_booking.id,
    'scheduledDeadline', v_handover.check_in_deadline,
    'flaggedAt', pg_catalog.clock_timestamp(),
    'checkInStatus', CASE
      WHEN v_handover.checked_in_at IS NULL THEN 'outstanding'
      ELSE 'returned late'
    END,
    'previousLateFlags', v_previous_flags,
    'lateFlagThreshold', COALESCE((
      SELECT settings.late_flag_threshold
      FROM resourcehub_private.institution_accountability_settings AS settings
      WHERE settings.institution_id = v_booking.institution_id
    ), 5),
    'studentHistoryUrl', '/owner/handover?studentUserId=' || v_booking.requester_user_id,
    'handoverUrl', '/owner/handover?bookingId=' || v_booking.id,
    'timezone', v_timezone
  );

  INSERT INTO public.activity_events (
    institution_id, actor_id, resource_id, booking_id, event_type, summary, metadata
  )
  VALUES (
    v_booking.institution_id,
    p_detected_by,
    v_booking.resource_id,
    v_booking.id,
    'late_return_flagged',
    'A booking passed its check-in deadline.',
    v_notification_details
  );

  IF EXISTS (
    SELECT 1
    FROM public.institution_memberships AS membership
    JOIN public.institution_membership_roles AS membership_role
      ON membership_role.membership_id = membership.id
    WHERE membership.id = v_resource.owner_membership_id
      AND membership.institution_id = v_booking.institution_id
      AND membership.user_id = v_resource.owner_user_id
      AND membership.status = 'active'
      AND membership_role.role = 'resource_owner'
  )
  THEN
    INSERT INTO public.notifications (
      recipient_id,
      institution_id,
      title,
      body,
      details,
      dedupe_key
    )
    VALUES (
      v_resource.owner_user_id,
      v_booking.institution_id,
      'Important: Late Check-out Detected',
      pg_catalog.format(
        'Student %s (%s): %s resource %s (%s) for booking %s. Scheduled booking end: %s (%s). Check-in deadline: %s (%s). Flagged: %s (%s). Status: %s. Previous late flags: %s. Handover: %s',
        v_student_name,
        v_booking.requester_user_id,
        CASE
          WHEN v_handover.checked_in_at IS NULL THEN 'has not checked in for'
          ELSE 'returned late'
        END,
        v_resource.name,
        v_resource.id,
        v_booking.id,
        pg_catalog.to_char(v_booking.ends_at AT TIME ZONE v_timezone, 'YYYY-MM-DD HH24:MI'),
        v_timezone,
        pg_catalog.to_char(v_handover.check_in_deadline AT TIME ZONE v_timezone, 'YYYY-MM-DD HH24:MI'),
        v_timezone,
        pg_catalog.to_char(pg_catalog.clock_timestamp() AT TIME ZONE v_timezone, 'YYYY-MM-DD HH24:MI'),
        v_timezone,
        v_notification_details ->> 'checkInStatus',
        v_previous_flags,
        '/owner/handover?booking=' || v_booking.id
      ),
      v_notification_details,
      'late_return:' || v_booking.id
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION resourcehub_private.create_late_return_flag(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.record_booking_condition_report(uuid, text, text, text, text[]);

CREATE FUNCTION public.record_booking_condition_report(
  p_booking_id uuid,
  p_phase text,
  p_rating text,
  p_notes text,
  p_checklist text[],
  p_evidence_paths text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_resource public.resources%ROWTYPE;
  v_report_id uuid;
  v_checkout_report_id uuid;
  v_checkin_report_id uuid;
  v_checked_out_at timestamptz;
  v_checked_in_at timestamptz;
  v_recorded_at timestamptz;
  v_handover public.handover_records%ROWTYPE;
  v_deadline timestamptz;
  v_on_time boolean;
  v_duration_seconds bigint;
  v_student_name text;
  v_institution_name text;
  v_timezone text;
  v_details jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING errcode = '42501';
  END IF;
  IF p_phase NOT IN ('check_out', 'check_in')
    OR p_rating NOT IN ('excellent', 'good', 'minor_wear', 'damaged')
    OR p_notes IS NULL
    OR length(p_notes) > 2000
    OR p_checklist IS NULL
    OR pg_catalog.cardinality(p_checklist) = 0
    OR pg_catalog.cardinality(p_checklist) > 100
    OR p_evidence_paths IS NULL
    OR pg_catalog.cardinality(p_evidence_paths) > 8
    OR (p_rating = 'damaged' AND length(pg_catalog.btrim(p_notes)) < 10)
  THEN
    RAISE EXCEPTION 'Condition report is invalid.' USING errcode = '22023';
  END IF;

  SELECT booking.* INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.' USING errcode = 'P0002';
  END IF;
  SELECT resource.* INTO v_resource
  FROM public.resources AS resource
  WHERE resource.id = v_booking.resource_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource not found.' USING errcode = 'P0002';
  END IF;
  IF v_actor <> v_booking.requester_user_id
    OR NOT EXISTS (
      SELECT 1
      FROM public.institution_memberships AS membership
      JOIN public.institution_membership_roles AS membership_role
        ON membership_role.membership_id = membership.id
      WHERE membership.institution_id = v_booking.institution_id
        AND membership.user_id = v_actor
        AND membership.status = 'active'
        AND membership_role.role = 'student'
    )
  THEN
    RAISE EXCEPTION 'Only the active student who owns this booking can record a handover.'
      USING errcode = '42501';
  END IF;
  IF p_phase = 'check_out'
    AND (
      v_booking.status <> 'approved'
      OR v_booking.starts_at > pg_catalog.clock_timestamp()
      OR pg_catalog.clock_timestamp() >= v_booking.ends_at
    )
  THEN
    RAISE EXCEPTION 'Only a due approved booking can be checked out.'
      USING errcode = '55000';
  END IF;
  IF p_phase = 'check_in' AND v_booking.status <> 'in_use' THEN
    RAISE EXCEPTION 'Only an in-use booking can be checked in.'
      USING errcode = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(p_evidence_paths) AS evidence(path)
    WHERE evidence.path !~ (
      '^' || v_booking.institution_id::text || '/' || v_booking.id::text || '/'
      || p_phase || '/' || v_actor::text || '/[A-Za-z0-9._-]{1,180}$'
    )
      OR NOT EXISTS (
        SELECT 1 FROM storage.objects AS object
        WHERE object.bucket_id = 'handover-evidence'
          AND object.name = evidence.path
      )
  ) THEN
    RAISE EXCEPTION 'Condition evidence is invalid or unavailable.'
      USING errcode = '22023';
  END IF;

  INSERT INTO public.condition_reports (
    booking_id, phase, rating, notes, checklist, recorded_by, evidence_paths, recorded_at
  )
  VALUES (
    p_booking_id,
    p_phase,
    p_rating,
    pg_catalog.btrim(p_notes),
    p_checklist,
    v_actor,
    p_evidence_paths,
    pg_catalog.clock_timestamp()
  )
  RETURNING id, recorded_at INTO v_report_id, v_recorded_at;

  IF p_phase = 'check_out' THEN
    SELECT COALESCE(settings.timezone, 'UTC')
    INTO v_timezone
    FROM public.institutions AS institution
    LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
      ON settings.institution_id = institution.id
    WHERE institution.id = v_booking.institution_id;

    SELECT CASE
      WHEN settings.max_usage_duration_minutes IS NULL THEN v_booking.ends_at
      ELSE LEAST(
        v_booking.ends_at,
        v_recorded_at
          + pg_catalog.make_interval(mins => settings.max_usage_duration_minutes)
      )
    END
    INTO v_deadline
    FROM public.institutions AS institution
    LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
      ON settings.institution_id = institution.id
    WHERE institution.id = v_booking.institution_id;

    INSERT INTO public.handover_records (
      booking_id,
      institution_id,
      resource_id,
      student_user_id,
      check_out_report_id,
      checked_out_at,
      check_in_deadline,
      timezone
    )
    VALUES (
      p_booking_id,
      v_booking.institution_id,
      v_booking.resource_id,
      v_booking.requester_user_id,
      v_report_id,
      v_recorded_at,
      v_deadline,
      COALESCE(v_timezone, 'UTC')
    );

    UPDATE public.bookings SET status = 'in_use' WHERE id = p_booking_id;
    INSERT INTO public.activity_events (
      institution_id, actor_id, resource_id, booking_id, event_type, summary
    )
    VALUES (
      v_booking.institution_id,
      v_actor,
      v_booking.resource_id,
      p_booking_id,
      'check_out',
      'The student checked out the resource.'
    );
    RETURN v_report_id;
  END IF;

  SELECT handover.* INTO STRICT v_handover
  FROM public.handover_records AS handover
  WHERE handover.booking_id = p_booking_id
  FOR UPDATE;

  SELECT report.id INTO STRICT v_checkout_report_id
  FROM public.condition_reports AS report
  WHERE report.booking_id = p_booking_id AND report.phase = 'check_out';

  SELECT settings.timezone INTO v_timezone
  FROM public.institutions AS institution
  LEFT JOIN resourcehub_private.institution_accountability_settings AS settings
    ON settings.institution_id = institution.id
  WHERE institution.id = v_booking.institution_id;
  v_timezone := COALESCE(v_timezone, 'UTC');
  SELECT institution.name INTO v_institution_name
  FROM public.institutions AS institution
  WHERE institution.id = v_booking.institution_id;

  v_deadline := v_handover.check_in_deadline;
  v_checked_in_at := v_recorded_at;
  v_on_time := v_checked_in_at <= v_deadline;
  UPDATE public.handover_records
  SET check_in_report_id = v_report_id,
      checked_in_at = v_checked_in_at,
      returned_on_time = v_on_time,
      student_comments = pg_catalog.btrim(p_notes),
      updated_at = pg_catalog.clock_timestamp()
  WHERE booking_id = p_booking_id;
  UPDATE public.bookings SET status = 'completed' WHERE id = p_booking_id;
  INSERT INTO public.activity_events (
    institution_id, actor_id, resource_id, booking_id, event_type, summary
  )
  VALUES (
    v_booking.institution_id,
    v_actor,
    v_booking.resource_id,
    p_booking_id,
    'check_in',
    CASE WHEN v_on_time
      THEN 'The student returned the resource on time.'
      ELSE 'The student returned the resource after the check-in deadline.'
    END
  );

  IF NOT v_on_time THEN
    PERFORM resourcehub_private.create_late_return_flag(p_booking_id, v_actor);
  END IF;

  SELECT report.id INTO STRICT v_checkin_report_id
  FROM public.condition_reports AS report
  WHERE report.booking_id = p_booking_id AND report.phase = 'check_in';
  SELECT report.recorded_at INTO STRICT v_checked_out_at
  FROM public.condition_reports AS report
  WHERE report.id = v_checkout_report_id;
  SELECT report.recorded_at INTO STRICT v_checked_in_at
  FROM public.condition_reports AS report
  WHERE report.id = v_checkin_report_id;
  SELECT COALESCE(NULLIF(pg_catalog.btrim(profile.display_name), ''), 'Student')
  INTO v_student_name
  FROM public.profiles AS profile
  WHERE profile.id = v_booking.requester_user_id;
  v_student_name := COALESCE(v_student_name, 'Student');
  v_duration_seconds := GREATEST(
    0,
    pg_catalog.floor(extract(epoch FROM v_checked_in_at - v_checked_out_at))
  )::bigint;
  v_details := pg_catalog.jsonb_build_object(
    'type', 'handover_summary',
    'studentName', v_student_name,
    'studentId', v_booking.requester_user_id,
    'institutionName', v_institution_name,
    'resourceName', v_resource.name,
    'resourceId', v_resource.id,
    'institutionId', v_booking.institution_id,
    'bookingId', v_booking.id,
    'scheduledStart', v_booking.starts_at,
    'scheduledEnd', v_booking.ends_at,
    'checkedOutAt', v_checked_out_at,
    'checkedInAt', v_checked_in_at,
    'usageDurationSeconds', v_duration_seconds,
    'checkInDeadline', v_deadline,
    'returnedOnTime', v_on_time,
    'checkOut', (
      SELECT pg_catalog.jsonb_build_object(
        'rating', report.rating,
        'checklist', report.checklist,
        'comments', report.notes,
        'evidence', report.evidence_paths
      )
      FROM public.condition_reports AS report
      WHERE report.id = v_checkout_report_id
    ),
    'checkIn', (
      SELECT pg_catalog.jsonb_build_object(
        'rating', report.rating,
        'checklist', report.checklist,
        'comments', report.notes,
        'evidence', report.evidence_paths
      )
      FROM public.condition_reports AS report
      WHERE report.id = v_checkin_report_id
    ),
    'timezone', v_timezone,
    'url', '/owner/handover?bookingId=' || v_booking.id
  );

  INSERT INTO public.notifications (
    recipient_id,
    institution_id,
    title,
    body,
    details,
    dedupe_key
  )
  SELECT
    v_resource.owner_user_id,
    v_booking.institution_id,
    'Equipment handover completed',
    pg_catalog.format(
      '%s returned %s at %s for booking %s. Usage: %s minutes. Return: %s. View the complete handover: %s',
      v_student_name,
      v_resource.name,
      v_institution_name,
      v_booking.id,
      pg_catalog.floor(v_duration_seconds / 60.0),
      CASE WHEN v_on_time THEN 'on time' ELSE 'late' END,
      '/owner/handover?bookingId=' || v_booking.id
    ),
    v_details,
    'handover:' || v_booking.id
  WHERE v_resource.owner_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.institution_memberships AS membership
      JOIN public.institution_membership_roles AS membership_role
        ON membership_role.membership_id = membership.id
      WHERE membership.id = v_resource.owner_membership_id
        AND membership.institution_id = v_booking.institution_id
        AND membership.user_id = v_resource.owner_user_id
        AND membership.status = 'active'
        AND membership_role.role = 'resource_owner'
    )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  IF v_booking.requester_user_id IS DISTINCT FROM v_resource.owner_user_id THEN
    INSERT INTO public.notifications (
      recipient_id,
      institution_id,
      title,
      body,
      details,
      dedupe_key
    )
    VALUES (
      v_booking.requester_user_id,
      v_booking.institution_id,
      'Handover completed',
      pg_catalog.format(
        'You returned %s at %s for booking %s. Usage: %s minutes. Return: %s.',
        v_resource.name,
        v_institution_name,
        v_booking.id,
        pg_catalog.floor(v_duration_seconds / 60.0),
        CASE WHEN v_on_time THEN 'on time' ELSE 'late' END
      ),
      v_details,
      'handover_student:' || v_booking.id
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_booking_condition_report(uuid, text, text, text, text[], text[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_booking_condition_report(uuid, text, text, text, text[], text[])
  TO authenticated;

CREATE FUNCTION public.process_overdue_handover_flags(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking record;
  v_processed integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'The overdue handover batch size is invalid.'
      USING errcode = '22023';
  END IF;

  FOR v_booking IN
    SELECT booking.id,
           handover.check_in_deadline
    FROM public.bookings AS booking
    JOIN public.handover_records AS handover
      ON handover.booking_id = booking.id
      AND handover.checked_in_at IS NULL
    JOIN public.institutions AS institution
      ON institution.id = booking.institution_id
      AND institution.is_active
    WHERE booking.status = 'in_use'
      AND NOT EXISTS (
        SELECT 1 FROM public.late_return_flags AS flag
        WHERE flag.booking_id = booking.id
      )
    ORDER BY handover.check_in_deadline, booking.id
    LIMIT p_limit
    FOR UPDATE OF booking, handover SKIP LOCKED
  LOOP
    IF v_booking.check_in_deadline < pg_catalog.clock_timestamp()
      AND resourcehub_private.create_late_return_flag(v_booking.id, NULL)
    THEN
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_overdue_handover_flags(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_overdue_handover_flags(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.queue_scheduled_booking_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created integer;
BEGIN
  WITH due AS (
    SELECT
      booking.id AS booking_id,
      'booking_start_reminder'::text AS event_type,
      booking.requester_user_id AS recipient_id,
      booking.institution_id,
      'Booking starts soon'::text AS title,
      'Your approved resource booking starts within 24 hours.'::text AS body
    FROM public.bookings AS booking
    JOIN public.institutions AS institution
      ON institution.id = booking.institution_id
      AND institution.is_active
    JOIN public.resources AS resource
      ON resource.id = booking.resource_id
      AND resource.archived_at IS NULL
    WHERE booking.status = 'approved'
      AND booking.starts_at > pg_catalog.clock_timestamp()
      AND booking.starts_at <= pg_catalog.clock_timestamp() + interval '24 hours'

    UNION ALL

    SELECT
      booking.id,
      'booking_return_reminder'::text,
      booking.requester_user_id,
      booking.institution_id,
      'Booking ends soon'::text,
      'Your in-use resource booking is due to end within one hour.'::text
    FROM public.bookings AS booking
    JOIN public.institutions AS institution
      ON institution.id = booking.institution_id
      AND institution.is_active
    JOIN public.resources AS resource
      ON resource.id = booking.resource_id
      AND resource.archived_at IS NULL
    WHERE booking.status = 'in_use'
      AND booking.ends_at > pg_catalog.clock_timestamp()
      AND booking.ends_at <= pg_catalog.clock_timestamp() + interval '1 hour'

    UNION ALL

    SELECT
      booking.id,
      'booking_overdue'::text,
      booking.requester_user_id,
      booking.institution_id,
      'Resource return overdue'::text,
      'Your in-use resource booking has passed its scheduled end time.'::text
    FROM public.bookings AS booking
    JOIN public.institutions AS institution
      ON institution.id = booking.institution_id
      AND institution.is_active
    JOIN public.resources AS resource
      ON resource.id = booking.resource_id
      AND resource.archived_at IS NULL
    WHERE booking.status = 'in_use'
      AND booking.ends_at <= pg_catalog.clock_timestamp()
  ),
  queued AS (
    INSERT INTO resourcehub_private.notification_scheduled_events (
      booking_id, event_type, recipient_id, institution_id
    )
    SELECT DISTINCT
      due.booking_id,
      due.event_type,
      due.recipient_id,
      due.institution_id
    FROM due
    ON CONFLICT (booking_id, event_type, recipient_id) DO NOTHING
    RETURNING booking_id, event_type, recipient_id, institution_id
  )
  INSERT INTO public.notifications (
    recipient_id, institution_id, title, body
  )
  SELECT
    queued.recipient_id,
    queued.institution_id,
    due.title,
    due.body
  FROM queued
  JOIN due
    ON due.booking_id = queued.booking_id
    AND due.event_type = queued.event_type
    AND due.recipient_id = queued.recipient_id
    AND due.institution_id = queued.institution_id;

  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN v_created;
END;
$$;
