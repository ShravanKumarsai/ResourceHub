CREATE OR REPLACE FUNCTION public.get_public_landing_stats()
RETURNS TABLE (
  institutions_participating bigint,
  resources_available bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH eligible_resources AS (
    SELECT resource.institution_id
    FROM public.resources AS resource
    JOIN public.institutions AS institution
      ON institution.id = resource.institution_id
    WHERE institution.is_active
      AND resource.listed
      AND resource.archived_at IS NULL
  )
  SELECT
    count(DISTINCT eligible_resources.institution_id),
    count(*)
  FROM eligible_resources;
$function$;

REVOKE ALL ON FUNCTION public.get_public_landing_stats()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_landing_stats()
  TO anon, authenticated;
