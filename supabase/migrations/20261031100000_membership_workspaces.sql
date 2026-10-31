-- Persist membership intent and expose only institution-scoped directory fields.

alter table public.institution_memberships
  add column requested_role text;

alter table public.institution_memberships
  add constraint institution_memberships_requested_role_check
  check (requested_role is null or requested_role in ('student', 'resource_owner'));

comment on column public.institution_memberships.requested_role is
  'Role requested by the applicant. NULL is retained only for legacy requests created before this column existed; it does not grant access.';

grant insert (requested_role) on public.institution_memberships to authenticated;

drop policy "Users can request their own institution membership"
  on public.institution_memberships;
create policy "Users can request their own institution membership"
on public.institution_memberships
for insert to authenticated
with check (
  public.institution_memberships.user_id = auth.uid()
  and public.institution_memberships.status = 'pending'
  and public.institution_memberships.requested_role in ('student', 'resource_owner')
  and public.institution_memberships.reviewed_at is null
  and public.institution_memberships.reviewed_by is null
  and public.institution_memberships.verified_at is null
  and public.institution_memberships.verified_by is null
  and exists (
    select 1
    from public.institutions as institution
    where institution.id = public.institution_memberships.institution_id
      and institution.is_active
  )
);

drop function public.list_pending_membership_applicants(uuid);

create function public.list_pending_membership_applicants(
  p_institution_id uuid
)
returns table (
  membership_id uuid,
  requested_at timestamptz,
  applicant_name text,
  applicant_email text,
  requested_role text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_institution_id is null or not exists (
    select 1
    from public.institutions as institution
    join public.institution_memberships as admin_membership
      on admin_membership.institution_id = institution.id
    join public.institution_membership_roles as admin_role
      on admin_role.membership_id = admin_membership.id
    where institution.id = p_institution_id
      and institution.is_active
      and admin_membership.user_id = v_actor_id
      and admin_membership.status = 'active'
      and admin_role.role = 'institution_admin'
  ) then
    raise exception 'An active administrator of this institution is required.'
      using errcode = '42501';
  end if;

  return query
  select
    membership.id,
    membership.requested_at,
    profile.display_name,
    auth_user.email::text,
    membership.requested_role,
    membership.status
  from public.institution_memberships as membership
  left join public.profiles as profile
    on profile.id = membership.user_id
  left join auth.users as auth_user
    on auth_user.id = membership.user_id
  where membership.institution_id = p_institution_id
    and membership.status = 'pending'
  order by membership.requested_at asc, membership.id;
end;
$$;

revoke all on function public.list_pending_membership_applicants(uuid)
  from public, anon, service_role;
grant execute on function public.list_pending_membership_applicants(uuid)
  to authenticated;

comment on function public.list_pending_membership_applicants(uuid) is
  'Returns only pending membership ID, request time, applicant display name and email, requested role, and status for the caller''s active institution where the caller is an active institution administrator.';

create function public.list_institution_membership_directory(
  p_institution_id uuid
)
returns table (
  membership_id uuid,
  applicant_name text,
  applicant_email text,
  requested_role text,
  approved_roles text[],
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_institution_id is null or not exists (
    select 1
    from public.institutions as institution
    join public.institution_memberships as admin_membership
      on admin_membership.institution_id = institution.id
    join public.institution_membership_roles as admin_role
      on admin_role.membership_id = admin_membership.id
    where institution.id = p_institution_id
      and institution.is_active
      and admin_membership.user_id = v_actor_id
      and admin_membership.status = 'active'
      and admin_role.role = 'institution_admin'
  ) then
    raise exception 'An active administrator of this institution is required.'
      using errcode = '42501';
  end if;

  return query
  select
    membership.id,
    profile.display_name,
    auth_user.email::text,
    membership.requested_role,
    coalesce(
      pg_catalog.array_agg(membership_role.role order by membership_role.role)
        filter (where membership_role.role is not null),
      array[]::text[]
    ),
    membership.status,
    membership.requested_at,
    membership.reviewed_at
  from public.institution_memberships as membership
  left join public.profiles as profile
    on profile.id = membership.user_id
  left join auth.users as auth_user
    on auth_user.id = membership.user_id
  left join public.institution_membership_roles as membership_role
    on membership_role.membership_id = membership.id
  where membership.institution_id = p_institution_id
  group by
    membership.id,
    profile.display_name,
    auth_user.email,
    membership.requested_role,
    membership.status,
    membership.requested_at,
    membership.reviewed_at
  order by membership.requested_at desc, membership.id;
end;
$$;

revoke all on function public.list_institution_membership_directory(uuid)
  from public, anon, service_role;
grant execute on function public.list_institution_membership_directory(uuid)
  to authenticated;

comment on function public.list_institution_membership_directory(uuid) is
  'Returns only membership name, email, requested role, approved roles, status, and request/review dates for the caller''s active institution where the caller is an active institution administrator.';

create or replace function public.review_institution_membership(
  p_membership_id uuid,
  p_status text,
  p_roles text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.institution_memberships%rowtype;
  v_institution_id uuid;
  v_institution_active boolean;
  v_old_roles text[];
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  update resourcehub_private.admin_invariant_mutex
  set generation = generation + 1
  where singleton;

  if not found then
    raise exception 'Administrator-invariant mutex is missing.'
      using errcode = '55000';
  end if;

  if p_status is null
    or p_status not in ('active', 'rejected', 'suspended', 'revoked')
  then
    raise exception 'Unsupported membership review status.'
      using errcode = '22023';
  end if;

  if p_roles is null
    or exists (
      select 1
      from pg_catalog.unnest(p_roles) as requested_role(role)
      where requested_role.role is null
        or requested_role.role not in ('student', 'resource_owner', 'institution_admin')
    )
    or pg_catalog.cardinality(p_roles) <> (
      select pg_catalog.count(distinct requested_role.role)
      from pg_catalog.unnest(p_roles) as requested_role(role)
    )
  then
    raise exception 'Membership roles are invalid or duplicated.'
      using errcode = '22023';
  end if;

  if (p_status = 'active' and pg_catalog.cardinality(p_roles) = 0)
    or (p_status <> 'active' and pg_catalog.cardinality(p_roles) <> 0)
  then
    raise exception 'Active memberships require roles; inactive memberships cannot retain roles.'
      using errcode = '22023';
  end if;

  select membership.institution_id
  into v_institution_id
  from public.institution_memberships as membership
  where membership.id = p_membership_id;

  if not found then
    raise exception 'Membership not found.'
      using errcode = 'P0002';
  end if;

  select institution.is_active
  into v_institution_active
  from public.institutions as institution
  where institution.id = v_institution_id;

  if not found then
    raise exception 'Institution not found.'
      using errcode = 'P0002';
  end if;

  if not v_institution_active
    or not resourcehub_private.is_institution_admin(v_institution_id)
  then
    raise exception 'An active administrator of this institution is required.'
      using errcode = '42501';
  end if;

  select membership.*
  into v_membership
  from public.institution_memberships as membership
  where membership.id = p_membership_id;

  if not found then
    raise exception 'Membership not found.'
      using errcode = 'P0002';
  end if;

  if v_membership.user_id = v_actor_id then
    raise exception 'Administrators cannot review their own membership.'
      using errcode = '42501';
  end if;

  if p_status in ('active', 'rejected')
    and v_membership.status <> 'pending'
  then
    raise exception 'Only pending memberships can be approved or rejected.'
      using errcode = '55000';
  end if;

  if v_membership.status = 'pending'
    and p_status not in ('active', 'rejected')
  then
    raise exception 'Pending memberships can only be approved or rejected.'
      using errcode = '55000';
  end if;

  if p_status = 'active'
    and v_membership.status = 'pending'
    and v_membership.requested_role is not null
    and (
      pg_catalog.cardinality(p_roles) <> 1
      or not exists (
        select 1
        from pg_catalog.unnest(p_roles) as requested_role(role)
        where requested_role.role = v_membership.requested_role
      )
    )
  then
    raise exception 'Approval must grant the role requested by the applicant.'
      using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(membership_role.role order by membership_role.role),
    array[]::text[]
  )
  into v_old_roles
  from public.institution_membership_roles as membership_role
  where membership_role.membership_id = v_membership.id;

  if 'institution_admin' = any(p_roles)
    and not ('institution_admin' = any(v_old_roles))
  then
    raise exception 'Administrator privileges must be assigned through the administrator transfer procedure.'
      using errcode = '42501';
  end if;

  if 'institution_admin' = any(v_old_roles)
    and (
      p_status <> 'active'
      or not ('institution_admin' = any(p_roles))
    )
    and not exists (
      select 1
      from public.institution_memberships as other_membership
      join public.institution_membership_roles as other_role
        on other_role.membership_id = other_membership.id
      where other_membership.institution_id = v_membership.institution_id
        and other_membership.id <> v_membership.id
        and other_membership.status = 'active'
        and other_role.role = 'institution_admin'
    )
  then
    raise exception 'An institution must retain at least one active administrator.'
      using errcode = '23514';
  end if;

  update public.institution_memberships
  set status = p_status,
      reviewed_at = pg_catalog.now(),
      reviewed_by = v_actor_id,
      verified_at = case when p_status = 'active' then pg_catalog.now() else null end,
      verified_by = case when p_status = 'active' then v_actor_id else null end
  where id = v_membership.id;

  delete from public.institution_membership_roles
  where membership_id = v_membership.id;

  insert into public.institution_membership_roles (
    membership_id,
    role,
    granted_by
  )
  select v_membership.id, requested_role.role, v_actor_id
  from pg_catalog.unnest(p_roles) as requested_role(role);

  insert into public.institution_membership_events (
    membership_id,
    institution_id,
    actor_id,
    actor_kind,
    action,
    from_status,
    to_status,
    from_roles,
    to_roles
  )
  values (
    v_membership.id,
    v_membership.institution_id,
    v_actor_id,
    'user',
    'membership_review',
    v_membership.status,
    p_status,
    v_old_roles,
    p_roles
  );
end;
$$;

revoke all on function public.review_institution_membership(uuid, text, text[])
  from public, anon, service_role;
grant execute on function public.review_institution_membership(uuid, text, text[])
  to authenticated;

comment on function public.review_institution_membership(uuid, text, text[]) is
  'Institution admins may review only memberships in their active institution. Approval and rejection are pending-only, serialized, self-review is forbidden, requested roles are enforced, role changes and an institution-scoped audit event occur atomically.';
