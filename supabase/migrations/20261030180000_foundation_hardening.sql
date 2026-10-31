-- Forward-only hardening for the identity foundation.
-- No users, institutions, memberships, or demo data are created by this migration.

alter table public.institution_memberships
  alter column user_id drop not null;

alter table public.institution_memberships
  add column account_deleted_at timestamptz;

alter table public.institution_memberships
  add constraint institution_memberships_active_requires_user
  check (status <> 'active' or user_id is not null);

alter table public.institution_memberships
  drop constraint institution_memberships_user_id_fkey;

alter table public.institution_memberships
  add constraint institution_memberships_user_id_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete set null;

alter table public.institution_membership_events
  add column institution_id uuid;

update public.institution_membership_events as membership_event
set institution_id = membership.institution_id
from public.institution_memberships as membership
where membership.id = membership_event.membership_id;

alter table public.institution_membership_events
  alter column membership_id drop not null,
  alter column institution_id set not null,
  add column action text not null default 'membership_review'
    check (action in (
      'membership_review',
      'account_anonymized',
      'initial_admin_provisioned',
      'administrator_transfer'
    )),
  add column actor_kind text not null default 'user'
    check (actor_kind in ('user', 'anonymized', 'system', 'operator')),
  add column actor_principal text;

alter table public.institution_membership_events
  drop constraint institution_membership_events_membership_id_fkey;

alter table public.institution_membership_events
  add constraint institution_membership_events_institution_id_fkey
    foreign key (institution_id)
    references public.institutions(id)
    on delete restrict,
  add constraint institution_membership_events_membership_institution_fkey
    foreign key (membership_id, institution_id)
    references public.institution_memberships(id, institution_id)
    on delete set null (membership_id);

create index institution_membership_events_institution_created_idx
  on public.institution_membership_events (institution_id, created_at desc);

create table resourcehub_private.retention_policy (
  policy_id smallint primary key check (policy_id = 1),
  retention_period interval not null check (retention_period > interval '0 seconds'),
  approved_by text not null check (length(btrim(approved_by)) > 0),
  approved_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- A singleton write mutex keeps all identity/admin mutations in one lock order.
create table resourcehub_private.admin_invariant_mutex (
  singleton boolean primary key default true check (singleton),
  generation bigint not null default 0
);

insert into resourcehub_private.admin_invariant_mutex (singleton, generation)
values (true, 0);

comment on table resourcehub_private.admin_invariant_mutex is
  'Internal transaction mutex serializing identity and administrator writes; not application data.';

create table resourcehub_private.retention_policy_changes (
  id bigint generated always as identity primary key,
  previous_period interval,
  new_period interval not null,
  approved_by text not null,
  approved_at timestamptz not null,
  changed_by text not null,
  changed_at timestamptz not null default now()
);

create table resourcehub_private.legal_holds (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null
    references public.institutions(id) on delete restrict,
  target_kind text not null check (target_kind in ('membership', 'event')),
  target_id uuid not null,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  placed_by text not null check (length(btrim(placed_by)) > 0),
  placed_at timestamptz not null default now(),
  released_by text,
  released_at timestamptz,
  release_reason text,
  check (
    (released_at is null and released_by is null and release_reason is null)
    or
    (released_at is not null
      and released_by is not null
      and length(btrim(released_by)) > 0
      and release_reason is not null
      and length(btrim(release_reason)) between 1 and 2000)
  ),
  check (released_at is null or released_at >= placed_at)
);

create index legal_holds_active_target_idx
  on resourcehub_private.legal_holds (institution_id, target_kind, target_id)
  where released_at is null;

alter table resourcehub_private.retention_policy enable row level security;
alter table resourcehub_private.admin_invariant_mutex enable row level security;
alter table resourcehub_private.retention_policy_changes enable row level security;
alter table resourcehub_private.legal_holds enable row level security;

revoke all on schema resourcehub_private
  from public, anon, authenticated, service_role;
grant usage on schema resourcehub_private to authenticated;

revoke all on resourcehub_private.retention_policy
  from public, anon, authenticated, service_role;
revoke all on resourcehub_private.admin_invariant_mutex
  from public, anon, authenticated, service_role;
revoke all on resourcehub_private.retention_policy_changes
  from public, anon, authenticated, service_role;
revoke all on resourcehub_private.legal_holds
  from public, anon, authenticated, service_role;
revoke all on table
  public.institutions,
  public.profiles,
  public.institution_memberships,
  public.institution_membership_roles,
  public.institution_membership_events
from service_role;

create function resourcehub_private.acquire_admin_invariant_mutex()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update resourcehub_private.admin_invariant_mutex
  set generation = generation + 1
  where singleton;

  if not found then
    raise exception 'Administrator-invariant mutex is missing.'
      using errcode = '55000';
  end if;

  return null;
end;
$$;

create trigger institutions_00_admin_mutex
before insert or update or delete on public.institutions
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create trigger memberships_00_admin_mutex
before insert or update or delete on public.institution_memberships
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create trigger membership_roles_00_admin_mutex
before insert or update or delete on public.institution_membership_roles
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create trigger membership_events_00_admin_mutex
before update or delete on public.institution_membership_events
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create trigger legal_holds_00_admin_mutex
before insert or update or delete on resourcehub_private.legal_holds
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create trigger retention_policy_00_admin_mutex
before insert or update or delete on resourcehub_private.retention_policy
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create trigger profiles_00_admin_mutex
before delete on public.profiles
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create trigger auth_users_00_admin_mutex
before delete on auth.users
for each statement execute function resourcehub_private.acquire_admin_invariant_mutex();

create function resourcehub_private.guard_membership_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.institution_id is distinct from old.institution_id then
      raise exception 'A membership cannot be moved to another institution.'
        using errcode = '23514';
    end if;

    if new.user_id is distinct from old.user_id
      and not (
        old.user_id is not null
        and new.user_id is null
        and new.status = 'revoked'
        and new.account_deleted_at is not null
      )
    then
      raise exception 'Membership ownership cannot be changed.'
        using errcode = '23514';
    end if;

  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger institution_memberships_00_lock_institution
before insert or update or delete on public.institution_memberships
for each row execute function resourcehub_private.guard_membership_scope();

create function resourcehub_private.guard_membership_role_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.membership_id is distinct from old.membership_id then
    raise exception 'A membership role cannot be moved to another membership.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger institution_membership_roles_10_guard_scope
before insert or update or delete on public.institution_membership_roles
for each row execute function resourcehub_private.guard_membership_role_scope();

create function resourcehub_private.assert_active_institution_has_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid;
  v_is_active boolean;
begin
  if tg_table_name = 'institutions' then
    if tg_op = 'DELETE' then
      v_institution_id := old.id;
    else
      v_institution_id := new.id;
    end if;
  elsif tg_table_name = 'institution_memberships' then
    if tg_op = 'DELETE' then
      v_institution_id := old.institution_id;
    else
      v_institution_id := new.institution_id;
    end if;
  else
    if tg_op = 'DELETE' then
      select membership.institution_id into v_institution_id
      from public.institution_memberships as membership
      where membership.id = old.membership_id;
    else
      select membership.institution_id into v_institution_id
      from public.institution_memberships as membership
      where membership.id = new.membership_id;
    end if;
  end if;

  if v_institution_id is null then
    return null;
  end if;

  select institution.is_active
  into v_is_active
  from public.institutions as institution
  where institution.id = v_institution_id;

  if not found or not v_is_active then
    return null;
  end if;

  if not exists (
    select 1
    from public.institution_memberships as membership
    join public.institution_membership_roles as membership_role
      on membership_role.membership_id = membership.id
    where membership.institution_id = v_institution_id
      and membership.status = 'active'
      and membership_role.role = 'institution_admin'
  ) then
    raise exception 'An active institution must have at least one active administrator.'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger institutions_90_require_active_admin
after insert or update or delete on public.institutions
deferrable initially deferred
for each row execute function resourcehub_private.assert_active_institution_has_admin();

create constraint trigger memberships_90_require_active_admin
after insert or update or delete on public.institution_memberships
deferrable initially deferred
for each row execute function resourcehub_private.assert_active_institution_has_admin();

create constraint trigger membership_roles_90_require_active_admin
after insert or update or delete on public.institution_membership_roles
deferrable initially deferred
for each row execute function resourcehub_private.assert_active_institution_has_admin();

create function resourcehub_private.guard_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retention_period interval;
begin
  if exists (
    select 1
    from resourcehub_private.legal_holds as legal_hold
    where legal_hold.institution_id = old.institution_id
      and legal_hold.released_at is null
      and (
        (legal_hold.target_kind = 'membership' and legal_hold.target_id = old.id)
        or (
          legal_hold.target_kind = 'event'
          and exists (
            select 1
            from public.institution_membership_events as membership_event
            where membership_event.id = legal_hold.target_id
              and membership_event.institution_id = old.institution_id
              and membership_event.membership_id = old.id
          )
        )
      )
  ) then
    raise exception 'An active legal hold prevents membership deletion.'
      using errcode = '55000';
  end if;

  select policy.retention_period
  into v_retention_period
  from resourcehub_private.retention_policy as policy
  where policy.policy_id = 1;

  if not found then
    raise exception 'Retention policy is not configured; deletion is disabled.'
      using errcode = '55000';
  end if;

  if old.created_at > pg_catalog.clock_timestamp() - v_retention_period then
    raise exception 'Membership is within the configured retention period.'
      using errcode = '55000';
  end if;

  return old;
end;
$$;

create trigger institution_memberships_10_guard_delete
before delete on public.institution_memberships
for each row execute function resourcehub_private.guard_membership_delete();

create function resourcehub_private.guard_membership_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retention_period interval;
  v_candidate public.institution_membership_events%rowtype;
begin
  if tg_op = 'UPDATE' then
    if old.actor_id is not null and new.actor_id is null then
      if exists (
        select 1
        from resourcehub_private.legal_holds as legal_hold
        where legal_hold.institution_id = old.institution_id
          and legal_hold.released_at is null
          and (
            (legal_hold.target_kind = 'event' and legal_hold.target_id = old.id)
            or (
              legal_hold.target_kind = 'membership'
              and old.membership_id is not null
              and legal_hold.target_id = old.membership_id
            )
          )
      ) then
        raise exception 'An active legal hold prevents actor anonymization.'
          using errcode = '55000';
      end if;

      v_candidate := new;
      v_candidate.actor_id := old.actor_id;
      v_candidate.actor_kind := old.actor_kind;
      v_candidate.actor_principal := old.actor_principal;

      if v_candidate is distinct from old then
        raise exception 'Membership events are immutable except for actor anonymization.'
          using errcode = '55000';
      end if;

      new.actor_kind := 'anonymized';
      new.actor_principal := null;
      return new;
    end if;

    if old.membership_id is not null and new.membership_id is null then
      v_candidate := new;
      v_candidate.membership_id := old.membership_id;

      if v_candidate is distinct from old
        or exists (
          select 1
          from public.institution_memberships as membership
          where membership.id = old.membership_id
        )
      then
        raise exception 'An event can be detached only when its membership is deleted.'
          using errcode = '55000';
      end if;

      return new;
    end if;

    raise exception 'Membership events are append-only.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from resourcehub_private.legal_holds as legal_hold
    where legal_hold.institution_id = old.institution_id
      and legal_hold.released_at is null
      and (
        (legal_hold.target_kind = 'event' and legal_hold.target_id = old.id)
        or (
          legal_hold.target_kind = 'membership'
          and old.membership_id is not null
          and legal_hold.target_id = old.membership_id
        )
      )
  ) then
    raise exception 'An active legal hold prevents event deletion.'
      using errcode = '55000';
  end if;

  select policy.retention_period
  into v_retention_period
  from resourcehub_private.retention_policy as policy
  where policy.policy_id = 1;

  if not found then
    raise exception 'Retention policy is not configured; deletion is disabled.'
      using errcode = '55000';
  end if;

  if old.created_at > pg_catalog.clock_timestamp() - v_retention_period then
    raise exception 'Event is within the configured retention period.'
      using errcode = '55000';
  end if;

  return old;
end;
$$;

create trigger membership_events_00_guard_mutation
before update or delete on public.institution_membership_events
for each row execute function resourcehub_private.guard_membership_event_mutation();

comment on table public.institution_membership_events is
  'Append-only institution-scoped history; updates are limited to actor anonymization and membership detachment after membership deletion.';

create function resourcehub_private.validate_legal_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.target_kind = 'membership' and not exists (
      select 1
      from public.institution_memberships as membership
      where membership.id = new.target_id
        and membership.institution_id = new.institution_id
    ) then
      raise exception 'Legal hold membership target does not belong to its institution.'
        using errcode = '23503';
    elsif new.target_kind = 'event' and not exists (
      select 1
      from public.institution_membership_events as membership_event
      where membership_event.id = new.target_id
        and membership_event.institution_id = new.institution_id
    ) then
      raise exception 'Legal hold event target does not belong to its institution.'
        using errcode = '23503';
    end if;
    return new;
  end if;

  if old.released_at is not null
    or new.id is distinct from old.id
    or new.institution_id is distinct from old.institution_id
    or new.target_kind is distinct from old.target_kind
    or new.target_id is distinct from old.target_id
    or new.reason is distinct from old.reason
    or new.placed_by is distinct from old.placed_by
    or new.placed_at is distinct from old.placed_at
    or new.released_at is null
    or new.released_by is null
    or new.release_reason is null
    or length(btrim(new.released_by)) = 0
    or length(btrim(new.release_reason)) not between 1 and 2000
  then
    raise exception 'A legal hold is immutable except for one release.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger legal_holds_00_validate
before insert or update on resourcehub_private.legal_holds
for each row execute function resourcehub_private.validate_legal_hold();

create function resourcehub_private.prevent_legal_hold_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Legal hold records cannot be deleted.'
    using errcode = '55000';
end;
$$;

create trigger legal_holds_10_no_delete
before delete on resourcehub_private.legal_holds
for each row execute function resourcehub_private.prevent_legal_hold_delete();

create function resourcehub_private.audit_retention_policy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'The retention policy cannot be deleted.'
      using errcode = '55000';
  end if;

  insert into resourcehub_private.retention_policy_changes (
    previous_period,
    new_period,
    approved_by,
    approved_at,
    changed_by
  )
  values (
    case when tg_op = 'UPDATE' then old.retention_period else null end,
    new.retention_period,
    new.approved_by,
    new.approved_at,
    session_user::text
  );

  return new;
end;
$$;

create trigger retention_policy_00_audit
before insert or update or delete on resourcehub_private.retention_policy
for each row execute function resourcehub_private.audit_retention_policy_change();

create function resourcehub_private.guard_retention_policy_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Retention policy change history is append-only.'
    using errcode = '55000';
end;
$$;

create trigger retention_policy_changes_00_immutable
before update or delete on resourcehub_private.retention_policy_changes
for each row execute function resourcehub_private.guard_retention_policy_change_event();

create function resourcehub_private.anonymize_auth_user_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_ids uuid[];
  v_membership public.institution_memberships%rowtype;
  v_old_roles text[];
begin
  if exists (
    select 1
    from public.institution_memberships as membership
    join resourcehub_private.legal_holds as legal_hold
      on legal_hold.institution_id = membership.institution_id
    where membership.user_id = old.id
      and legal_hold.released_at is null
      and (
        (legal_hold.target_kind = 'membership' and legal_hold.target_id = membership.id)
        or (
          legal_hold.target_kind = 'event'
          and exists (
            select 1
            from public.institution_membership_events as membership_event
            where membership_event.id = legal_hold.target_id
              and membership_event.membership_id = membership.id
              and membership_event.institution_id = membership.institution_id
          )
        )
      )
  ) then
    raise exception 'An active legal hold prevents membership anonymization.'
      using errcode = '55000';
  end if;

  select pg_catalog.array_agg(distinct membership.institution_id order by membership.institution_id)
  into v_institution_ids
  from public.institution_memberships as membership
  where membership.user_id = old.id;

  if v_institution_ids is null then
    return old;
  end if;

  perform institution.id
  from public.institutions as institution
  where institution.id = any(v_institution_ids)
  order by institution.id;

  for v_membership in
    select membership.*
    from public.institution_memberships as membership
    where membership.user_id = old.id
    order by membership.institution_id, membership.id
    for update
  loop
    select coalesce(
      pg_catalog.array_agg(membership_role.role order by membership_role.role),
      array[]::text[]
    )
    into v_old_roles
    from public.institution_membership_roles as membership_role
    where membership_role.membership_id = v_membership.id;

    delete from public.institution_membership_roles
    where membership_id = v_membership.id;

    insert into public.institution_membership_events (
      membership_id,
      institution_id,
      actor_id,
      actor_kind,
      actor_principal,
      action,
      from_status,
      to_status,
      from_roles,
      to_roles
    )
    values (
      v_membership.id,
      v_membership.institution_id,
      null,
      'system',
      'auth.users deletion trigger',
      'account_anonymized',
      v_membership.status,
      'revoked',
      v_old_roles,
      array[]::text[]
    );

    update public.institution_memberships
    set user_id = null,
        status = 'revoked',
        account_deleted_at = pg_catalog.clock_timestamp()
    where id = v_membership.id;
  end loop;

  return old;
end;
$$;

create trigger profiles_00_anonymize_memberships_before_delete
before delete on public.profiles
for each row execute function resourcehub_private.anonymize_auth_user_memberships();

revoke all on function resourcehub_private.acquire_admin_invariant_mutex()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.guard_membership_scope()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.guard_membership_role_scope()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.assert_active_institution_has_admin()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.guard_membership_delete()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.guard_membership_event_mutation()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.validate_legal_hold()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.prevent_legal_hold_delete()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.audit_retention_policy_change()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.guard_retention_policy_change_event()
  from public, anon, authenticated, service_role;
revoke all on function resourcehub_private.anonymize_auth_user_memberships()
  from public, anon, authenticated, service_role;

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
  where institution.id = v_institution_id;

  if not found then
    raise exception 'Institution not found.'
      using errcode = 'P0002';
  end if;

  select membership.*
  into v_membership
  from public.institution_memberships as membership
  where membership.id = p_membership_id;

  if not found then
    raise exception 'Membership not found.'
      using errcode = 'P0002';
  end if;

  if not resourcehub_private.is_institution_admin(v_membership.institution_id) then
    raise exception 'An active administrator of this institution is required.'
      using errcode = '42501';
  end if;

  if v_membership.user_id = v_actor_id then
    raise exception 'Administrators cannot review their own membership.'
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
    institution_id,
    actor_id,
    actor_kind,
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

create function public.transfer_institution_admin(
  p_outgoing_membership_id uuid,
  p_incoming_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_outgoing public.institution_memberships%rowtype;
  v_incoming public.institution_memberships%rowtype;
  v_outgoing_roles text[];
  v_incoming_roles text[];
  v_outgoing_to_roles text[];
  v_incoming_to_roles text[];
  v_outgoing_to_status text;
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

  if p_outgoing_membership_id is null
    or p_incoming_membership_id is null
    or p_outgoing_membership_id = p_incoming_membership_id
  then
    raise exception 'Distinct outgoing and incoming memberships are required.'
      using errcode = '22023';
  end if;

  select membership.*
  into v_outgoing
  from public.institution_memberships as membership
  where membership.id = p_outgoing_membership_id;

  select membership.*
  into v_incoming
  from public.institution_memberships as membership
  where membership.id = p_incoming_membership_id;

  if v_outgoing.id is null or v_incoming.id is null then
    raise exception 'Both memberships must exist.'
      using errcode = 'P0002';
  end if;

  if v_outgoing.institution_id <> v_incoming.institution_id then
    raise exception 'Administrator transfers cannot cross institutions.'
      using errcode = '42501';
  end if;

  if v_outgoing.user_id <> v_actor_id
    or v_outgoing.status <> 'active'
    or not resourcehub_private.is_institution_admin(v_outgoing.institution_id)
  then
    raise exception 'An active administrator may transfer only their own administrator role.'
      using errcode = '42501';
  end if;

  if v_incoming.user_id is null
    or v_incoming.status <> 'active'
    or v_incoming.user_id = v_actor_id
  then
    raise exception 'The replacement must be another user''s active membership.'
      using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(membership_role.role order by membership_role.role),
    array[]::text[]
  )
  into v_outgoing_roles
  from public.institution_membership_roles as membership_role
  where membership_role.membership_id = v_outgoing.id;

  select coalesce(
    pg_catalog.array_agg(membership_role.role order by membership_role.role),
    array[]::text[]
  )
  into v_incoming_roles
  from public.institution_membership_roles as membership_role
  where membership_role.membership_id = v_incoming.id;

  if not ('institution_admin' = any(v_outgoing_roles)) then
    raise exception 'The outgoing membership is not an administrator.'
      using errcode = '23514';
  end if;

  if 'institution_admin' = any(v_incoming_roles) then
    raise exception 'The replacement is already an administrator.'
      using errcode = '23514';
  end if;

  v_outgoing_to_roles := pg_catalog.array_remove(v_outgoing_roles, 'institution_admin');
  v_incoming_to_roles := v_incoming_roles || array['institution_admin']::text[];
  v_outgoing_to_status := case
    when pg_catalog.cardinality(v_outgoing_to_roles) = 0 then 'revoked'
    else 'active'
  end;

  insert into public.institution_membership_roles (
    membership_id, role, granted_by
  )
  values (
    v_incoming.id, 'institution_admin', v_actor_id
  );

  update public.institution_memberships
  set reviewed_at = pg_catalog.now(),
      reviewed_by = v_actor_id
  where id = v_incoming.id;

  delete from public.institution_membership_roles
  where membership_id = v_outgoing.id
    and role = 'institution_admin';

  update public.institution_memberships
  set status = v_outgoing_to_status,
      reviewed_at = pg_catalog.now(),
      reviewed_by = v_actor_id,
      verified_at = case
        when v_outgoing_to_status = 'active' then verified_at
        else null
      end,
      verified_by = case
        when v_outgoing_to_status = 'active' then verified_by
        else null
      end
  where id = v_outgoing.id;

  insert into public.institution_membership_events (
    membership_id, institution_id, actor_id, actor_kind, action,
    from_status, to_status, from_roles, to_roles
  )
  values
    (
      v_outgoing.id, v_outgoing.institution_id, v_actor_id, 'user',
      'administrator_transfer', v_outgoing.status, v_outgoing_to_status,
      v_outgoing_roles, v_outgoing_to_roles
    ),
    (
      v_incoming.id, v_incoming.institution_id, v_actor_id, 'user',
      'administrator_transfer', v_incoming.status, v_incoming.status,
      v_incoming_roles, v_incoming_to_roles
    );
end;
$$;

revoke all on function public.transfer_institution_admin(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.transfer_institution_admin(uuid, uuid)
  to authenticated;

drop policy "Anonymous users can read active institutions" on public.institutions;
create policy "Anonymous users can read active institutions"
on public.institutions
for select to anon
using (public.institutions.is_active);

drop policy "Authenticated users can read active institutions and administer their own"
  on public.institutions;
create policy "Authenticated users can read active institutions and administer their own"
on public.institutions
for select to authenticated
using (
  public.institutions.is_active
  or resourcehub_private.is_institution_admin(public.institutions.id)
);

drop policy "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select to authenticated
using (public.profiles.id = auth.uid());

drop policy "Users can update their own editable profile fields" on public.profiles;
create policy "Users can update their own editable profile fields"
on public.profiles
for update to authenticated
using (public.profiles.id = auth.uid())
with check (public.profiles.id = auth.uid());

drop policy "Users and institution admins can read memberships"
  on public.institution_memberships;
create policy "Users and institution admins can read memberships"
on public.institution_memberships
for select to authenticated
using (
  public.institution_memberships.user_id = auth.uid()
  or resourcehub_private.is_institution_admin(
    public.institution_memberships.institution_id
  )
);

drop policy "Users can request their own institution membership"
  on public.institution_memberships;
create policy "Users can request their own institution membership"
on public.institution_memberships
for insert to authenticated
with check (
  public.institution_memberships.user_id = auth.uid()
  and public.institution_memberships.status = 'pending'
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

drop policy "Users and institution admins can read membership roles"
  on public.institution_membership_roles;
create policy "Users and institution admins can read membership roles"
on public.institution_membership_roles
for select to authenticated
using (
  exists (
    select 1
    from public.institution_memberships as membership
    where membership.id = public.institution_membership_roles.membership_id
      and (
        membership.user_id = auth.uid()
        or resourcehub_private.is_institution_admin(membership.institution_id)
      )
  )
);

drop policy "Users and institution admins can read membership events"
  on public.institution_membership_events;
create policy "Users and institution admins can read membership events"
on public.institution_membership_events
for select to authenticated
using (
  resourcehub_private.is_institution_admin(
    public.institution_membership_events.institution_id
  )
  or exists (
    select 1
    from public.institution_memberships as membership
    where membership.id = public.institution_membership_events.membership_id
      and membership.user_id = auth.uid()
  )
);
