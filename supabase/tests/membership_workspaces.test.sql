begin;

select plan(35);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000801', 'authenticated', 'authenticated',
    'workspace-admin-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000802', 'authenticated', 'authenticated',
    'workspace-admin-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000803', 'authenticated', 'authenticated',
    'workspace-student@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000804', 'authenticated', 'authenticated',
    'workspace-manager@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000805', 'authenticated', 'authenticated',
    'workspace-new-user@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.institutions (id, name, slug)
values
  ('00000000-0000-4000-8000-000000000811', 'Workspace Test A', 'workspace-test-a'),
  ('00000000-0000-4000-8000-000000000812', 'Workspace Test B', 'workspace-test-b');

insert into public.institution_memberships (
  id, institution_id, user_id, status, requested_role, reviewed_at, verified_at
)
values
  ('00000000-0000-4000-8000-000000000821',
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000801', 'active', null, now(), now()),
  ('00000000-0000-4000-8000-000000000822',
    '00000000-0000-4000-8000-000000000812',
    '00000000-0000-4000-8000-000000000802', 'active', null, now(), now()),
  ('00000000-0000-4000-8000-000000000823',
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000803', 'pending', 'student', null, null),
  ('00000000-0000-4000-8000-000000000824',
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000804', 'pending', 'resource_owner', null, null);

insert into public.institution_membership_roles (membership_id, role)
values
  ('00000000-0000-4000-8000-000000000821', 'institution_admin'),
  ('00000000-0000-4000-8000-000000000822', 'institution_admin');

update public.profiles
set display_name = case id
  when '00000000-0000-4000-8000-000000000803' then 'Student Applicant'
  when '00000000-0000-4000-8000-000000000804' then 'Resource Manager Applicant'
  when '00000000-0000-4000-8000-000000000805' then 'New Applicant'
  else display_name
end
where id in (
  '00000000-0000-4000-8000-000000000803',
  '00000000-0000-4000-8000-000000000804',
  '00000000-0000-4000-8000-000000000805'
);

set constraints all immediate;
set constraints all deferred;

select ok(
  not has_function_privilege(
    'anon',
    'public.list_pending_membership_applicants(uuid)',
    'EXECUTE'
  ),
  'Anonymous callers cannot execute the applicant-list function'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.list_institution_membership_directory(uuid)',
    'EXECUTE'
  ),
  'Anonymous callers cannot execute the membership directory'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.list_institution_membership_directory(uuid)',
    'EXECUTE'
  ),
  'Service role is not granted membership directory execution'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.institution_membership_roles',
    'INSERT'
  ),
  'Applicants cannot directly assign membership roles'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.institution_memberships',
    'requested_role',
    'UPDATE'
  ),
  'Applicants cannot change their requested role after submission'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000803', true);
select throws_ok(
  $$select * from public.list_pending_membership_applicants(
    '00000000-0000-4000-8000-000000000811'
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'A student applicant cannot list pending requests'
);
select throws_ok(
  $$select * from public.list_institution_membership_directory(
    '00000000-0000-4000-8000-000000000811'
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'A student applicant cannot view the institution directory'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select throws_ok(
  $$select * from public.list_pending_membership_applicants(
    '00000000-0000-4000-8000-000000000811'
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'An administrator from another institution cannot list applicants'
);
select throws_ok(
  $$select * from public.list_institution_membership_directory(
    '00000000-0000-4000-8000-000000000811'
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'An administrator from another institution cannot view the directory'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select is(
  (select count(*)::integer
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000811'
   )),
  2,
  'An institution administrator sees only pending applicants at their institution'
);
select is(
  (select applicant_name
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000811'
   )
   where membership_id = '00000000-0000-4000-8000-000000000824'),
  'Resource Manager Applicant',
  'The pending applicant RPC returns the display name'
);
select is(
  (select applicant_email
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000811'
   )
   where membership_id = '00000000-0000-4000-8000-000000000824'),
  'workspace-manager@example.invalid',
  'The pending applicant RPC returns only the target applicant email'
);
select is(
  (select requested_role
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000811'
   )
   where membership_id = '00000000-0000-4000-8000-000000000824'),
  'resource_owner',
  'The pending applicant RPC returns the requested role'
);
select is(
  (select status
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000811'
   )
   where membership_id = '00000000-0000-4000-8000-000000000824'),
  'pending',
  'The pending applicant RPC returns membership status'
);
select is(
  (select count(*)::integer
   from public.list_institution_membership_directory(
     '00000000-0000-4000-8000-000000000811'
   )),
  3,
  'The institution directory returns only records for the authorized institution'
);
select is(
  (select approved_roles
   from public.list_institution_membership_directory(
     '00000000-0000-4000-8000-000000000811'
   )
   where membership_id = '00000000-0000-4000-8000-000000000821'),
  array['institution_admin']::text[],
  'The directory reports the existing approved role'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000805', true);
select throws_ok(
  $$insert into public.institution_memberships (institution_id, user_id)
    values (
      '00000000-0000-4000-8000-000000000811',
      '00000000-0000-4000-8000-000000000805'
    )$$,
  '42501',
  'new row violates row-level security policy for table "institution_memberships"',
  'A membership request without a requested role is rejected'
);
select lives_ok(
  $$insert into public.institution_memberships (
      institution_id, user_id, requested_role
    )
    values (
      '00000000-0000-4000-8000-000000000811',
      '00000000-0000-4000-8000-000000000805',
      'student'
    )$$,
  'An authenticated user can request a supported role without receiving it'
);
select is(
  (select status from public.institution_memberships
   where id = (
     select id from public.institution_memberships
     where user_id = '00000000-0000-4000-8000-000000000805'
       and institution_id = '00000000-0000-4000-8000-000000000811'
   )),
  'pending',
  'A new role request is saved as pending'
);
select is(
  (select count(*)::integer
   from public.institution_membership_roles as membership_role
   join public.institution_memberships as membership
     on membership.id = membership_role.membership_id
   where membership.user_id = '00000000-0000-4000-8000-000000000805'),
  0,
  'Submitting a requested role does not assign an approved role'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000824',
    'active',
    array['student']
  )$$,
  '22023',
  'Approval must grant the role requested by the applicant.',
  'An administrator cannot approve a request with a different role'
);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000824',
    'active',
    pg_catalog.array_fill('student'::text, array[1], array[0])
  )$$,
  '22023',
  'Approval must grant the role requested by the applicant.',
  'A non-default PostgreSQL array lower bound cannot bypass requested-role validation'
);
select lives_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000824',
    'active',
    array['resource_owner']
  )$$,
  'A resource manager request can be approved with its requested role'
);
select is(
  (select status from public.institution_memberships
   where id = '00000000-0000-4000-8000-000000000824'),
  'active',
  'Approval activates the membership'
);
select is(
  (select role from public.institution_membership_roles
   where membership_id = '00000000-0000-4000-8000-000000000824'),
  'resource_owner',
  'Approval assigns the existing resource_owner role'
);
select is(
  (select count(*)::integer
   from public.institution_membership_events
   where membership_id = '00000000-0000-4000-8000-000000000824'
     and institution_id = '00000000-0000-4000-8000-000000000811'
     and actor_id = '00000000-0000-4000-8000-000000000801'
     and action = 'membership_review'
     and from_status = 'pending'
     and to_status = 'active'),
  1,
  'Approval appends an institution-scoped audit event'
);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000824',
    'rejected',
    array[]::text[]
  )$$,
  '55000',
  'Only pending memberships can be approved or rejected.',
  'A second review cannot overwrite the approved membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000823',
    'rejected',
    array[]::text[]
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'An administrator from another institution cannot review the applicant'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select lives_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000823',
    'rejected',
    array[]::text[]
  )$$,
  'An administrator can reject a pending student request'
);
select is(
  (select status from public.institution_memberships
   where id = '00000000-0000-4000-8000-000000000823'),
  'rejected',
  'Rejection leaves the membership rejected'
);
select is(
  (select count(*)::integer
   from public.institution_membership_events
   where membership_id = '00000000-0000-4000-8000-000000000823'
     and institution_id = '00000000-0000-4000-8000-000000000811'
     and actor_id = '00000000-0000-4000-8000-000000000801'
     and action = 'membership_review'
     and from_status = 'pending'
     and to_status = 'rejected'),
  1,
  'Rejection appends an institution-scoped audit event'
);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000821',
    'revoked',
    array[]::text[]
  )$$,
  '42501',
  'Administrators cannot review their own membership.',
  'An administrator cannot revoke their own membership through the review RPC'
);
select is(
  (select count(*)::integer
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000811'
   )),
  1,
  'The pending applicant list excludes approved and rejected requests'
);
select is(
  (select count(*)::integer
   from public.list_institution_membership_directory(
     '00000000-0000-4000-8000-000000000811'
   )),
  4,
  'The directory includes pending, approved, rejected, and administrator memberships'
);
select is(
  (select approved_roles
   from public.list_institution_membership_directory(
     '00000000-0000-4000-8000-000000000811'
   )
   where membership_id = '00000000-0000-4000-8000-000000000824'),
  array['resource_owner']::text[],
  'The directory reports the approved Resource Manager role'
);

reset role;
select * from finish();
rollback;
