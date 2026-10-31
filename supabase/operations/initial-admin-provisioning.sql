\set ON_ERROR_STOP on

BEGIN;

DO $check_operator$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this procedure as the trusted postgres database operator.';
  END IF;
END
$check_operator$;

SELECT auth_user.id AS verified_user_id
FROM auth.users AS auth_user
JOIN public.profiles AS profile ON profile.id = auth_user.id
WHERE auth_user.id = :'auth_user_id'::uuid
  AND auth_user.email_confirmed_at IS NOT NULL
\gset

INSERT INTO public.institutions (name, slug)
VALUES (:'institution_name', :'institution_slug')
RETURNING id AS created_institution_id
\gset

INSERT INTO public.institution_memberships (
  institution_id, user_id, status, reviewed_at, verified_at
)
VALUES (
  :'created_institution_id'::uuid,
  :'verified_user_id'::uuid,
  'active',
  now(),
  now()
)
RETURNING id AS created_membership_id
\gset

INSERT INTO public.institution_membership_roles (membership_id, role)
VALUES (:'created_membership_id'::uuid, 'institution_admin');

INSERT INTO public.institution_membership_events (
  membership_id, institution_id, actor_kind, actor_principal, action,
  from_status, to_status, from_roles, to_roles
)
VALUES (
  :'created_membership_id'::uuid,
  :'created_institution_id'::uuid,
  'operator',
  session_user::text,
  'initial_admin_provisioned',
  NULL,
  'active',
  ARRAY[]::text[],
  ARRAY['institution_admin']::text[]
);

COMMIT;
