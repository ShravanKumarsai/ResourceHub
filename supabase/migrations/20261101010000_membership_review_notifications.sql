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

drop trigger if exists institution_memberships_notify_review_result
  on public.institution_memberships;

create trigger institution_memberships_notify_review_result
after update of status on public.institution_memberships
for each row
when (old.status = 'pending' and new.status in ('active', 'rejected'))
execute function resourcehub_private.notify_membership_review_result();
