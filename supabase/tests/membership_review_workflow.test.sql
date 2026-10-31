begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000701', 'authenticated', 'authenticated',
    'review-admin-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000702', 'authenticated', 'authenticated',
    'review-admin-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000703', 'authenticated', 'authenticated',
    'review-applicant-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000704', 'authenticated', 'authenticated',
    'review-applicant-b@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.institutions (id, name, slug)
values
  ('00000000-0000-4000-8000-000000000711', 'Review Test A', 'review-test-a'),
  ('00000000-0000-4000-8000-000000000712', 'Review Test B', 'review-test-b');

insert into public.institution_memberships (
  id, institution_id, user_id, status, reviewed_at, verified_at
)
values
  ('00000000-0000-4000-8000-000000000721',
    '00000000-0000-4000-8000-000000000711',
    '00000000-0000-4000-8000-000000000701', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000000722',
    '00000000-0000-4000-8000-000000000712',
    '00000000-0000-4000-8000-000000000702', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000000723',
    '00000000-0000-4000-8000-000000000711',
    '00000000-0000-4000-8000-000000000703', 'pending', null, null),
  ('00000000-0000-4000-8000-000000000724',
    '00000000-0000-4000-8000-000000000711',
    '00000000-0000-4000-8000-000000000704', 'pending', null, null);

insert into public.institution_membership_roles (membership_id, role)
values
  ('00000000-0000-4000-8000-000000000721', 'institution_admin'),
  ('00000000-0000-4000-8000-000000000722', 'institution_admin');

update public.profiles
set display_name = case id
  when '00000000-0000-4000-8000-000000000703' then 'Resource Manager Applicant'
  when '00000000-0000-4000-8000-000000000704' then 'Second Applicant'
  else display_name
end
where id in (
  '00000000-0000-4000-8000-000000000703',
  '00000000-0000-4000-8000-000000000704'
);

set constraints all immediate;
set constraints all deferred;

select throws_ok(
  $$select * from public.list_pending_membership_applicants(
    '00000000-0000-4000-8000-000000000711'
  )$$,
  '42501',
  'Authentication is required.',
  'Unauthenticated callers cannot list applicants'
);
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
    'service_role',
    'public.list_pending_membership_applicants(uuid)',
    'EXECUTE'
  ),
  'The service role is not granted applicant-list execution'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000703', true);
select throws_ok(
  $$select * from public.list_pending_membership_applicants(
    '00000000-0000-4000-8000-000000000711'
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'A non-administrator cannot list applicants'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000702', true);
select throws_ok(
  $$select * from public.list_pending_membership_applicants(
    '00000000-0000-4000-8000-000000000711'
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'An administrator from another institution cannot list applicants'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000701', true);
select is(
  (select count(*)::integer
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000711'
   )),
  2,
  'An administrator can list pending applicants for their institution'
);
select is(
  (select applicant_name
   from public.list_pending_membership_applicants(
     '00000000-0000-4000-8000-000000000711'
   )
   where membership_id = '00000000-0000-4000-8000-000000000723'),
  'Resource Manager Applicant',
  'The applicant RPC returns the minimum display name needed for review'
);
select is(
  (select count(*)::integer
   from public.profiles
   where id = '00000000-0000-4000-8000-000000000703'),
  0,
  'Ordinary profile RLS still hides another user profile'
);

select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000723',
    'active',
    array['institution_admin']
  )$$,
  '42501',
  'Administrator privileges must be assigned through the administrator transfer procedure.',
  'Membership review cannot grant new administrator privileges'
);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000723',
    'revoked',
    array[]::text[]
  )$$,
  '55000',
  'Pending memberships can only be approved or rejected.',
  'Pending requests cannot bypass approve/reject with an inactive status'
);

select lives_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000723', 'active', array['resource_owner']
  )$$,
  'An institution administrator can approve a pending resource manager request'
);
select is(
  (select status from public.institution_memberships
   where id = '00000000-0000-4000-8000-000000000723'),
  'active',
  'Approval activates the membership'
);
select is(
  (select role from public.institution_membership_roles
   where membership_id = '00000000-0000-4000-8000-000000000723'),
  'resource_owner',
  'Resource manager approval assigns the existing resource_owner role'
);
select is(
  (select count(*)::integer
   from public.institution_membership_events
   where membership_id = '00000000-0000-4000-8000-000000000723'
     and institution_id = '00000000-0000-4000-8000-000000000711'
     and actor_id = '00000000-0000-4000-8000-000000000701'
     and action = 'membership_review'
     and from_status = 'pending'
     and to_status = 'active'),
  1,
  'Approval appends a correctly scoped audit event with the admin actor'
);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000723', 'rejected', array[]::text[]
  )$$,
  '55000',
  'Only pending memberships can be approved or rejected.',
  'A second decision cannot overwrite an already reviewed request'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000702', true);
select throws_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000724', 'active', array['resource_owner']
  )$$,
  '42501',
  'An active administrator of this institution is required.',
  'An administrator from another institution cannot review a request'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000701', true);
select lives_ok(
  $$select public.review_institution_membership(
    '00000000-0000-4000-8000-000000000724', 'rejected', array[]::text[]
  )$$,
  'An administrator can reject a pending request'
);
select is(
  (select count(*)::integer
   from public.institution_membership_events
   where membership_id = '00000000-0000-4000-8000-000000000724'
     and institution_id = '00000000-0000-4000-8000-000000000711'
     and actor_id = '00000000-0000-4000-8000-000000000701'
     and action = 'membership_review'
     and from_status = 'pending'
     and to_status = 'rejected'),
  1,
  'Rejection appends an institution-scoped audit event'
);

reset role;
select * from finish();
rollback;
