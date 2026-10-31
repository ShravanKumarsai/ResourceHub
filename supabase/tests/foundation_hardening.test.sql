begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'foundation-admin-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'foundation-admin-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
    'foundation-student@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
    'foundation-other-admin@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
    'foundation-delete-user@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
    'foundation-sole-admin@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.institutions (id, name, slug)
values
  ('00000000-0000-4000-8000-000000000201', 'Foundation Test A', 'foundation-test-a'),
  ('00000000-0000-4000-8000-000000000202', 'Foundation Test B', 'foundation-test-b'),
  ('00000000-0000-4000-8000-000000000203', 'Foundation Test C', 'foundation-test-c');

insert into public.institution_memberships (
  id, institution_id, user_id, status, reviewed_at, verified_at
)
values
  ('00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000001', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000002', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000003', 'pending', null, null),
  ('00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000004', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000000105',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000005', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000000106',
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000006', 'active', now(), now());

update public.institution_memberships
set created_at = now() - interval '11 years'
where id = '00000000-0000-4000-8000-000000000103';

insert into public.institution_membership_roles (membership_id, role)
values
  ('00000000-0000-4000-8000-000000000101', 'institution_admin'),
  ('00000000-0000-4000-8000-000000000102', 'institution_admin'),
  ('00000000-0000-4000-8000-000000000104', 'institution_admin'),
  ('00000000-0000-4000-8000-000000000105', 'student'),
  ('00000000-0000-4000-8000-000000000106', 'institution_admin');

insert into public.institution_membership_events (
  id, membership_id, institution_id, action, actor_kind,
  actor_id, from_status, to_status, created_at
)
values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000201',
  'membership_review',
  'user',
  '00000000-0000-4000-8000-000000000005',
  'pending',
  'rejected',
  now() - interval '11 years'
);

insert into public.institution_membership_events (
  id, membership_id, institution_id, actor_id, action, actor_kind,
  from_status, to_status, created_at
)
values (
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000105',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000005',
  'membership_review',
  'user',
  'pending',
  'active',
  now() - interval '10 years'
);

set constraints all immediate;
set constraints all deferred;

select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000103', 'active', array['student']
  )$$,
  '42501',
  'Authentication is required.',
  'Unauthenticated callers cannot review memberships'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000103', 'active', array['student']
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'A student cannot review a membership'
);
select throws_ok(
  $$insert into public.institution_membership_roles (membership_id, role)
    values ('00000000-0000-4000-8000-000000000103', 'institution_admin')$$,
  '42501',
  null,
  'A student cannot grant themselves an administrator role'
);
select throws_ok(
  $$update public.institution_memberships
    set status = 'active'
    where id = '00000000-0000-4000-8000-000000000103'$$,
  '42501',
  null,
  'A student cannot modify their membership status directly'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000101',
    'active',
    array['institution_admin']
  )$$,
  '42501',
  'Administrators cannot review their own membership.',
  'An administrator cannot review their own membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000103', 'active', array['student']
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'An administrator from another institution cannot review the application'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.transfer_institution_admin(
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000104'
  )$$,
  '42501',
  'Administrator transfers cannot cross institutions.',
  'An administrator cannot transfer privileges across institutions'
);
select lives_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000103', 'active', array['student']
  )$$,
  'An institution administrator can review another member'
);
select is(
  (select count(*)::integer
   from public.institution_membership_events as membership_event
   where membership_event.membership_id = '00000000-0000-4000-8000-000000000103'
     and membership_event.action = 'membership_review'),
  2,
  'A successful membership review appends an audit event'
);

select throws_ok(
  $$select count(*) from resourcehub_private.legal_holds$$,
  '42501',
  null,
  'Authenticated users cannot read private legal holds'
);
reset role;
set local role service_role;
select throws_ok(
  $$select count(*) from resourcehub_private.legal_holds$$,
  '42501',
  null,
  'The service role cannot access private legal holds'
);
reset role;

insert into resourcehub_private.legal_holds (
  institution_id, target_kind, target_id, reason, placed_by
)
values (
  '00000000-0000-4000-8000-000000000201',
  'event',
  '00000000-0000-4000-8000-000000000301',
  'Disposable test hold',
  'disposable-test-operator'
);

select throws_ok(
  $$delete from public.institution_membership_events
    where id = '00000000-0000-4000-8000-000000000301'$$,
  '55000',
  'An active legal hold prevents event deletion.',
  'An active event hold blocks event deletion'
);
select throws_ok(
  $$delete from public.institution_memberships
    where id = '00000000-0000-4000-8000-000000000103'$$,
  '55000',
  'An active legal hold prevents membership deletion.',
  'An active event hold blocks deletion of its membership'
);
select is(
  (select membership_id
   from public.institution_membership_events
   where id = '00000000-0000-4000-8000-000000000301'),
  '00000000-0000-4000-8000-000000000103'::uuid,
  'A held event remains associated with its membership'
);
select throws_ok(
  $$delete from auth.users
    where id = '00000000-0000-4000-8000-000000000005'$$,
  '55000',
  'An active legal hold prevents actor anonymization.',
  'A legal hold prevents account deletion from redacting the held event actor'
);
select ok(
  exists (
    select 1
    from auth.users
    where id = '00000000-0000-4000-8000-000000000005'
  ),
  'A held actor account remains intact when deletion is rejected'
);
select lives_ok(
  $$update resourcehub_private.legal_holds
    set released_by = 'disposable-test-operator',
        released_at = now(),
        release_reason = 'Disposable test complete'
    where target_id = '00000000-0000-4000-8000-000000000301'$$,
  'A trusted operator can release a legal hold once'
);
select throws_ok(
  $$delete from public.institution_memberships
    where id = '00000000-0000-4000-8000-000000000103'$$,
  '55000',
  'Retention policy is not configured; deletion is disabled.',
  'Membership deletion remains blocked until a retention policy is configured'
);
select throws_ok(
  $$delete from public.institution_membership_events
    where id = '00000000-0000-4000-8000-000000000301'$$,
  '55000',
  'Retention policy is not configured; deletion is disabled.',
  'Event deletion remains blocked until a retention policy is configured'
);

select lives_ok(
  $$delete from auth.users
    where id = '00000000-0000-4000-8000-000000000005'$$,
  'Deleting a non-final administrator account preserves the institution'
);
select ok(
  exists (
    select 1
    from public.institution_memberships as membership
    where membership.id = '00000000-0000-4000-8000-000000000105'
      and membership.user_id is null
      and membership.status = 'revoked'
      and membership.account_deleted_at is not null
  )
  and not exists (
    select 1
    from public.institution_membership_roles as membership_role
    where membership_role.membership_id = '00000000-0000-4000-8000-000000000105'
  ),
  'Account deletion anonymizes the membership and removes its roles'
);
select ok(
  exists (
    select 1
    from public.institution_membership_events as membership_event
    where membership_event.id = '00000000-0000-4000-8000-000000000302'
      and membership_event.actor_id is null
      and membership_event.actor_kind = 'anonymized'
      and membership_event.institution_id = '00000000-0000-4000-8000-000000000201'
  ),
  'Account deletion redacts a deleted actor without changing event history'
);
select ok(
  exists (
    select 1
    from public.institution_membership_events as membership_event
    where membership_event.membership_id = '00000000-0000-4000-8000-000000000105'
      and membership_event.institution_id = '00000000-0000-4000-8000-000000000201'
      and membership_event.action = 'account_anonymized'
      and membership_event.actor_kind = 'system'
  ),
  'Account deletion writes an institution-scoped system event'
);

select throws_ok(
  $$do $test$
    begin
      delete from auth.users
      where id = '00000000-0000-4000-8000-000000000006';
      set constraints all immediate;
    end
  $test$;$$,
  '23514',
  'An active institution must have at least one active administrator.',
  'Auth deletion of the last active administrator is rejected'
);
select ok(
  exists (
    select 1 from auth.users
    where id = '00000000-0000-4000-8000-000000000006'
  ),
  'A rejected last-administrator deletion rolls back the Auth account deletion'
);

select throws_ok(
  $$do $test$
    begin
      update public.institution_memberships
      set status = 'revoked'
      where id = '00000000-0000-4000-8000-000000000106';
      delete from public.institution_membership_roles
      where membership_id = '00000000-0000-4000-8000-000000000106'
        and role = 'institution_admin';
      set constraints all immediate;
    end
  $test$;$$,
  '23514',
  'An active institution must have at least one active administrator.',
  'Direct SQL cannot revoke the last active administrator'
);
select throws_ok(
  $$do $test$
    begin
      insert into public.institutions (id, name, slug)
      values (
        '00000000-0000-4000-8000-000000000204',
        'Unstaffed institution',
        'unstaffed-institution'
      );
      set constraints all immediate;
    end
  $test$;$$,
  '23514',
  'An active institution must have at least one active administrator.',
  'An active institution cannot be created without an administrator'
);
select lives_ok(
  $$do $test$
    begin
      update public.institutions
      set is_active = false
      where id = '00000000-0000-4000-8000-000000000203';
      update public.institution_memberships
      set status = 'revoked'
      where id = '00000000-0000-4000-8000-000000000106';
      delete from public.institution_membership_roles
      where membership_id = '00000000-0000-4000-8000-000000000106'
        and role = 'institution_admin';
      set constraints all immediate;
    end
  $test$;$$,
  'An institution can be shut down and its last administrator revoked atomically'
);
select ok(
  exists (
    select 1
    from public.institutions as institution
    join public.institution_memberships as membership
      on membership.institution_id = institution.id
    where institution.id = '00000000-0000-4000-8000-000000000203'
      and not institution.is_active
      and membership.status = 'revoked'
  ),
  'A shutdown institution may have no active administrator'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.transfer_institution_admin(
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000103'
  )$$,
  'An outgoing administrator can transfer their role atomically'
);
reset role;
set constraints all immediate;
select is(
  (select count(*)::integer
   from public.institution_membership_events as membership_event
   where membership_event.action = 'administrator_transfer'
     and membership_event.membership_id in (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000103'
     )),
  2,
  'A successful administrator transfer writes both audit events'
);
select ok(
  exists (
    select 1
    from public.institution_memberships as membership
    join public.institution_membership_roles as membership_role
      on membership_role.membership_id = membership.id
    where membership.id = '00000000-0000-4000-8000-000000000103'
      and membership.status = 'active'
      and membership_role.role = 'institution_admin'
  )
  and not exists (
    select 1
    from public.institution_membership_roles as membership_role
    where membership_role.membership_id = '00000000-0000-4000-8000-000000000101'
      and membership_role.role = 'institution_admin'
  ),
  'The atomic transfer leaves the replacement active and removes the outgoing admin role'
);

select lives_ok(
  $$insert into resourcehub_private.retention_policy (
      policy_id, retention_period, approved_by, approved_at
    )
    values (1, interval '10 years', 'disposable-test-approval', now())$$,
  'A trusted operator can record a disposable test retention policy'
);
select lives_ok(
  $$delete from public.institution_memberships
    where id = '00000000-0000-4000-8000-000000000103'$$,
  'An expired, unheld membership can be purged after policy configuration'
);
select ok(
  exists (
    select 1
    from public.institution_membership_events as membership_event
    where membership_event.id = '00000000-0000-4000-8000-000000000301'
      and membership_event.membership_id is null
      and membership_event.institution_id = '00000000-0000-4000-8000-000000000201'
  ),
  'Purging a membership detaches but preserves its institution-scoped event'
);
select lives_ok(
  $$delete from public.institution_membership_events
    where id = '00000000-0000-4000-8000-000000000301'$$,
  'An expired, unheld event can be purged under the configured policy'
);
select throws_ok(
  $$delete from public.institution_membership_events
    where membership_id is null
      and institution_id = '00000000-0000-4000-8000-000000000201'
      and actor_id = '00000000-0000-4000-8000-000000000001'
      and action = 'membership_review'$$,
  '55000',
  'Event is within the configured retention period.',
  'A recent event remains protected after its membership is purged'
);
select is(
  (select count(*)::integer
   from resourcehub_private.retention_policy_changes
   where new_period = interval '10 years'
     and approved_by = 'disposable-test-approval'),
  1,
  'Retention policy approval is recorded in append-only history'
);

select * from finish();
rollback;
