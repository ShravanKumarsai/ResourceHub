DO $$
DECLARE
  v_existing_return_type oid;
BEGIN
  SELECT procedure.prorettype
  INTO v_existing_return_type
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = pg_catalog.to_regprocedure(
    'public.update_institution_name(uuid,text)'
  );

  IF FOUND AND v_existing_return_type <> 'public.institutions'::regtype THEN
    RAISE EXCEPTION
      'Existing public.update_institution_name(uuid,text) has an incompatible return type.';
  END IF;
END;
$$;

create or replace function public.update_institution_name(
  p_institution_id uuid,
  p_name text
)
returns public.institutions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_row public.institutions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_name is null then
    raise exception 'Institution name is required.'
      using errcode = '22023';
  end if;

  v_name := btrim(p_name);
  if v_name = '' or length(v_name) > 200 then
    raise exception 'Institution name is invalid.'
      using errcode = '22023';
  end if;

  update resourcehub_private.admin_invariant_mutex
  set generation = generation + 1
  where singleton;

  if not found then
    raise exception 'Administrator-invariant mutex is missing.'
      using errcode = '55000';
  end if;

  perform institution.id
  from public.institutions as institution
  where institution.id = p_institution_id
  for update;

  if not found then
    raise exception 'Institution not found.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.institutions as institution
    where institution.id = p_institution_id
      and institution.is_active
  ) or not resourcehub_private.is_institution_admin(p_institution_id) then
    raise exception 'Only active institution administrators can rename this institution.'
      using errcode = '42501';
  end if;

  update public.institutions
  set name = v_name,
      updated_at = now()
  where id = p_institution_id
  returning *
  into v_row;

  if not found then
    raise exception 'Institution not found.'
      using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_institution_name(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.update_institution_name(uuid, text) to authenticated;
