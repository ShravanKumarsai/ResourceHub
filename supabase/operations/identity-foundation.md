# Identity foundation operator procedures

These are trusted database-operator procedures, not application endpoints. Run
them only against the intended database after reviewing the target and change.
Do not use a browser key, user-editable Auth metadata, or a service-role key.

## Provision the first institution administrator

The foundation migration intentionally creates no institutions, users, or
memberships. An administrator must first exist as a confirmed Supabase Auth
user with a profile created by the Auth profile trigger. Existing Auth users
are not backfilled; this procedure fails if that profile is absent.

Use a trusted `postgres` database connection and `psql`. Supply the UUID of an
already confirmed Auth user and the institution's approved name and slug. The
transaction creates one institution, one active membership, an administrator
role, and an audit event attributed to the database operator (`session_user`).
The database's deferred active-administrator check validates the complete
transaction at commit. Run the checked-in
[`initial-admin-provisioning.sql`](./initial-admin-provisioning.sql):

Invoke with protected operator access, for example:

```powershell
psql --set auth_user_id='confirmed-auth-user-uuid' `
  --set institution_name='approved institution name' `
  --set institution_slug='approved-institution-slug' `
  --file supabase/operations/initial-admin-provisioning.sql
```
Do not commit filled-in operator/user values or credentials.

## Retention and legal holds

No retention interval is configured by this migration. Until a trusted operator
records a policy, deletion of memberships and membership events is rejected.
The project owner and appropriate legal/privacy stakeholders must confirm the
retention period, scope, and applicable jurisdiction before any policy row is
inserted. No statutory period is assumed here.

Once approved, a trusted operator may configure or revise the singleton policy
in a controlled transaction:

```sql
INSERT INTO resourcehub_private.retention_policy (
  policy_id, retention_period, approved_by, approved_at
)
VALUES (1, interval '<approved interval>', '<approver reference>', now())
ON CONFLICT (policy_id) DO UPDATE
SET retention_period = excluded.retention_period,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = now();
```

Each change is recorded in the private append-only
`retention_policy_changes` table. Application roles and `service_role` have no
access to retention policy or legal-hold tables. A trusted operator places or
releases a legal hold directly in `resourcehub_private.legal_holds`; each hold
is immutable other than one release, and hold history cannot be deleted.

There is deliberately no retention job or application RPC. Before an operator
manually deletes eligible records, they must review the applicable policy,
confirm the records' ages, and verify that no active hold applies. Database
triggers independently reject deletion before the configured interval or
while an active hold covers the target. Expired membership rows can be removed
without deleting their events; event rows have a separate retention check.

## Account deletion and administrator transfer

Delete Auth accounts through the trusted Supabase Auth Admin API or a database
operator. The profile's `BEFORE DELETE` trigger removes membership roles,
appends an institution-scoped system event, and anonymizes each membership
before the profile FK cascade completes. Memberships and events remain; actor
references to the deleted profile are redacted. If this would leave an active
institution without an active administrator, the deferred invariant aborts
the whole transaction. The Auth Admin API deletion therefore also fails.
An active hold on one of the user's memberships or on an event whose actor
would be redacted also aborts deletion; release must follow the approved
operator process before retrying.

For a transfer, the outgoing active administrator calls
`transfer_institution_admin` with their own membership and the replacement's
active membership. The single security-definer call grants the replacement
role, revokes the outgoing administrator role, and records both events in one
transaction. The generic review RPC separately rejects self-review. Before
deleting an outgoing administrator's Auth account through the Auth Admin API,
ensure a replacement administrator has already been committed. An institution
may be shut down by marking it inactive; inactive institutions do not require
an active administrator.

## Institution membership and workspace access

The deployed
[`20261031080000_membership_review_workflow.sql`](../migrations/20261031080000_membership_review_workflow.sql)
migration adds the pending-applicant RPC and hardens the existing membership
review function.

The forward-only
[`20261031100000_membership_workspaces.sql`](../migrations/20261031100000_membership_workspaces.sql)
migration adds `institution_memberships.requested_role`, constrained to
`student` or `resource_owner`. New membership requests must select one of
those roles and remain pending; this column is request intent, never an
authorization grant. Legacy requests keep a null requested role and require
an explicit role choice during review.

The new migration replaces the pending-applicant RPC with a narrow result
including display name, Auth email, requested role, membership ID, request
time, and status. It also adds an institution-admin-only membership directory
RPC returning only display name, email, requested/approved roles, status, and
request/review dates. Neither RPC broadens profile RLS or exposes general
`auth.users` access.

The existing `review_institution_membership` remains the only review function.
For new pending requests, it enforces that approval assigns exactly the
requested role. Rejection assigns no roles. It continues to enforce
institution-admin authorization, self-review protection, serialized decisions,
the last-active-administrator invariant, and institution-scoped audit events.
New `institution_admin` privileges remain reserved for trusted operator
provisioning or the existing administrator-transfer procedure.

Student and Resource Manager route layouts now verify an active membership
and exact approved role on the server. A workspace selection or requested role
cannot grant access. The resource, booking, incident, and activity interfaces
still use sample data in browser localStorage; they are visibly labeled
demo-only and are not represented as Supabase-backed workflows.

The new migration has not been applied to Supabase. Run the existing
[`membership_review_workflow.test.sql`](../tests/membership_review_workflow.test.sql)
and the additional
[`membership_workspaces.test.sql`](../tests/membership_workspaces.test.sql)
against a disposable database before deployment. No test result is claimed
until those database tests have actually run.

## Local database verification

The migration requires PostgreSQL 15+ for the composite `ON DELETE SET NULL`
column-list syntax. It has not been run in this workspace. After installing
the Supabase CLI and Docker, initialize local Supabase configuration without
linking the project to a remote ref, then run only the local stack:

```powershell
supabase init
supabase start
supabase db reset
supabase test db
$env:RESOURCEHUB_TEST_DATABASE_URL = '<local database URL on localhost:54322>'
node supabase/tests/concurrent_admin_invariant.mjs
```

The SQL pgTAP suite runs in a rollback transaction. The concurrency test creates
committed fixture rows in the local database; reset it after the test with
`supabase db reset`. The private singleton mutex serializes identity and
administrator writes across institutions. It is acquired by statement-level
triggers before row locks and by the two privileged RPCs before reading target
rows. This is intentionally conservative
for the current low-volume foundation; reassess its throughput before scaling
to high-volume writes. Direct operator scripts should not take row locks on
institutions before performing identity writes.
