-- Foundation only: create schema objects without seeding institutions or users.
create schema if not exists resourcehub_private;

revoke all on schema resourcehub_private from public, anon, authenticated;
grant usage on schema resourcehub_private to authenticated;

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  slug text not null unique
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text
    check (display_name is null or length(btrim(display_name)) between 1 and 120),
  title text
    check (title is null or length(btrim(title)) <= 160),
  department text
    check (department is null or length(btrim(department)) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null
    references public.institutions(id) on delete restrict,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'suspended', 'revoked')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, user_id),
  unique (id, institution_id),
  check (reviewed_by is null or reviewed_at is not null),
  check (verified_by is null or verified_at is not null)
);

create table public.institution_membership_roles (
  membership_id uuid not null
    references public.institution_memberships(id) on delete cascade,
  role text not null
    check (role in ('student', 'resource_owner', 'institution_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null,
  primary key (membership_id, role)
);

create table public.institution_membership_events (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null
    references public.institution_memberships(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text
    check (from_status is null or from_status in ('pending', 'active', 'rejected', 'suspended', 'revoked')),
  to_status text not null
    check (to_status in ('active', 'rejected', 'suspended', 'revoked')),
  from_roles text[] not null default '{}',
  to_roles text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index institution_memberships_user_status_idx
  on public.institution_memberships (user_id, status);
create index institution_memberships_institution_status_idx
  on public.institution_memberships (institution_id, status);
create index institution_memberships_reviewed_by_idx
  on public.institution_memberships (reviewed_by)
  where reviewed_by is not null;
create index institution_memberships_verified_by_idx
  on public.institution_memberships (verified_by)
  where verified_by is not null;
create index institution_membership_roles_role_idx
  on public.institution_membership_roles (role, membership_id);
create index institution_membership_events_membership_created_idx
  on public.institution_membership_events (membership_id, created_at desc);
create index institution_membership_events_actor_created_idx
  on public.institution_membership_events (actor_id, created_at desc);

create function resourcehub_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function resourcehub_private.set_updated_at() from public, anon, authenticated;

create trigger institutions_set_updated_at
before update on public.institutions
for each row execute function resourcehub_private.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function resourcehub_private.set_updated_at();

create trigger institution_memberships_set_updated_at
before update on public.institution_memberships
for each row execute function resourcehub_private.set_updated_at();

create function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

create function resourcehub_private.is_institution_admin(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.institution_memberships as membership
    join public.institution_membership_roles as membership_role
      on membership_role.membership_id = membership.id
    where membership.institution_id = p_institution_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership_role.role = 'institution_admin'
  );
$$;

revoke all on function resourcehub_private.is_institution_admin(uuid) from public, anon;
grant execute on function resourcehub_private.is_institution_admin(uuid) to authenticated;

create function public.review_institution_membership(
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
  v_old_roles text[];
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
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
      where requested_role.role not in ('student', 'resource_owner', 'institution_admin')
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

  perform institution.id
  from public.institutions as institution
  where institution.id = v_institution_id
  for update;

  if not found then
    raise exception 'Institution not found.'
      using errcode = 'P0002';
  end if;

  select membership.*
  into v_membership
  from public.institution_memberships as membership
  where membership.id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found.'
      using errcode = 'P0002';
  end if;

  if not resourcehub_private.is_institution_admin(v_membership.institution_id) then
    raise exception 'An active administrator of this institution is required.'
      using errcode = '42501';
  end if;

  select coalesce(
    pg_catalog.array_agg(membership_role.role order by membership_role.role),
    array[]::text[]
  )
  into v_old_roles
  from public.institution_membership_roles as membership_role
  where membership_role.membership_id = v_membership.id;

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
    actor_id,
    from_status,
    to_status,
    from_roles,
    to_roles
  )
  values (
    v_membership.id,
    v_actor_id,
    v_membership.status,
    p_status,
    v_old_roles,
    p_roles
  );
end;
$$;

revoke all on function public.review_institution_membership(uuid, text, text[]) from public, anon;
grant execute on function public.review_institution_membership(uuid, text, text[]) to authenticated;

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.institution_membership_roles enable row level security;
alter table public.institution_membership_events enable row level security;

revoke all on public.institutions from public, anon, authenticated;
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.institution_memberships from public, anon, authenticated;
revoke all on public.institution_membership_roles from public, anon, authenticated;
revoke all on public.institution_membership_events from public, anon, authenticated;

grant select on public.institutions to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, title, department) on public.profiles to authenticated;
grant select on public.institution_memberships to authenticated;
grant insert (institution_id, user_id) on public.institution_memberships to authenticated;
grant select on public.institution_membership_roles to authenticated;
grant select on public.institution_membership_events to authenticated;

create policy "Anonymous users can read active institutions"
on public.institutions
for select to anon
using (is_active);

create policy "Authenticated users can read active institutions and administer their own"
on public.institutions
for select to authenticated
using (is_active or resourcehub_private.is_institution_admin(id));

create policy "Users can read their own profile"
on public.profiles
for select to authenticated
using (id = auth.uid());

create policy "Users can update their own editable profile fields"
on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users and institution admins can read memberships"
on public.institution_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or resourcehub_private.is_institution_admin(institution_id)
);

create policy "Users can request their own institution membership"
on public.institution_memberships
for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and verified_at is null
  and verified_by is null
  and exists (
    select 1
    from public.institutions as institution
    where institution.id = institution_id
      and institution.is_active
  )
);

create policy "Users and institution admins can read membership roles"
on public.institution_membership_roles
for select to authenticated
using (
  exists (
    select 1
    from public.institution_memberships as membership
    where membership.id = membership_id
      and (
        membership.user_id = auth.uid()
        or resourcehub_private.is_institution_admin(membership.institution_id)
      )
  )
);

create policy "Users and institution admins can read membership events"
on public.institution_membership_events
for select to authenticated
using (
  exists (
    select 1
    from public.institution_memberships as membership
    where membership.id = membership_id
      and (
        membership.user_id = auth.uid()
        or resourcehub_private.is_institution_admin(membership.institution_id)
      )
  )
);
