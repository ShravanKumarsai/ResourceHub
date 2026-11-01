create or replace function resourcehub_private.notify_membership_review_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_name text;
  v_role_name text;
begin
  if old.status is distinct from 'pending'
    or new.status is not distinct from old.status
    or new.status not in ('active', 'rejected')
    or new.user_id is null
  then
    return new;
  end if;

  select institution.name
  into v_institution_name
  from public.institutions as institution
  where institution.id = new.institution_id;

  v_role_name := case new.requested_role
    when 'student' then 'Student / Researcher'
    when 'resource_owner' then 'Resource Manager'
    else 'requested'
  end;

  insert into public.notifications (
    recipient_id,
    institution_id,
    title,
    body
  )
  values (
    new.user_id,
    new.institution_id,
    case
      when new.status = 'active' then 'Institution access approved'
      else 'Institution access not approved'
    end,
    case
      when new.status = 'active' then
        'Your ' || v_role_name || ' access request for ' ||
        coalesce(v_institution_name, 'your institution') || ' was approved.'
      else
        'Your access request for ' ||
        coalesce(v_institution_name, 'your institution') || ' was not approved.'
    end
  );

  return new;
end;
$$;

revoke all on function resourcehub_private.notify_membership_review_result()
  from public, anon, authenticated, service_role;

DO $$
DECLARE
  v_trigger record;
  v_status_attnum smallint;
  v_when text;
BEGIN
  SELECT attribute.attnum
  INTO v_status_attnum
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.institution_memberships'::regclass
    AND attribute.attname = 'status'
    AND NOT attribute.attisdropped;

  SELECT trigger_row.tgfoid,
         trigger_row.tgtype,
         trigger_row.tgenabled,
         trigger_row.tgattr,
         trigger_row.tgqual
  INTO v_trigger
  FROM pg_catalog.pg_trigger AS trigger_row
  WHERE trigger_row.tgrelid = 'public.institution_memberships'::regclass
    AND trigger_row.tgname = 'institution_memberships_notify_review_result'
    AND NOT trigger_row.tgisinternal;

  IF FOUND THEN
    v_when := pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_expr(v_trigger.tgqual, 'public.institution_memberships'::regclass),
        '\s+',
        '',
        'g'
      )
    );

    IF v_trigger.tgfoid <> 'resourcehub_private.notify_membership_review_result()'::regprocedure
      OR v_trigger.tgtype <> 17
      OR v_trigger.tgenabled <> 'O'
      OR NOT (v_status_attnum = ANY(v_trigger.tgattr::smallint[]))
      OR v_when IS NULL
      OR pg_catalog.strpos(v_when, 'old.status=''pending''::text') = 0
      OR pg_catalog.strpos(
        v_when,
        'new.status=any(array[''active''::text,''rejected''::text])'
      ) = 0
    THEN
      RAISE EXCEPTION
        'Existing institution_memberships_notify_review_result trigger has an unexpected definition; inspect it before replacing.';
    END IF;
  ELSE
    CREATE TRIGGER institution_memberships_notify_review_result
    AFTER UPDATE OF status ON public.institution_memberships
    FOR EACH ROW
    WHEN (old.status = 'pending' AND new.status IN ('active', 'rejected'))
    EXECUTE FUNCTION resourcehub_private.notify_membership_review_result();
  END IF;
END;
$$;
