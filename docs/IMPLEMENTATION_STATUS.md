# ResourceHub implementation status

## Persistence overview

The application no longer uses the former global localStorage demo store or
seeded business records. These workflows are backed by Supabase and are
authorized on the server and/or by existing RLS policies:

| Workflow | Current status | Notes |
|---|---|---|
| Authentication and membership requests | Supabase-backed | Requested roles stay pending until reviewed; active approved memberships gate workspaces. |
| Resource discovery and detail | Supabase-backed | Publicly listed, non-archived resources are queried from PostgreSQL. |
| Resource creation and management | Supabase-backed | Server actions verify the authenticated Resource Manager and ownership. |
| Resource archive and restore | Migration-dependent | `20261101040000_resource_archive_favorites.sql` adds the archive state and RPCs. |
| Booking requests, decisions and cancellation | Supabase-backed | Existing booking RPCs, server authorization and database constraints remain authoritative. Reservation controls are feature-flagged. |
| Availability and waiting list | Migration-dependent | `20261101030000_availability_waiting_list.sql` is required for server-side conflict flags, persisted joins, cancellation and queue position. |
| Check-in, check-out and condition reports | Supabase-backed | Booking lifecycle and actor permissions are enforced server-side and in the database RPC. |
| Incident reporting and incident history | Supabase-backed | Incidents and event history are queried and mutated through authorized server operations, with bounded pagination. |
| Activity history | Supabase-backed | The view merges institution-scoped activity and membership events using database access controls. |
| In-app notifications | Supabase-backed | Existing notification records and read state remain in PostgreSQL. |
| Email and browser push delivery | Migration/configuration-dependent | Requires `20261101050000_notification_delivery.sql`, opt-in preferences, provider secrets and a working scheduled endpoint. Not verified as an active provider integration. |
| Institution administration | Supabase-backed | Membership review is persisted; the institution operations dashboard is scoped and read-only. |
| Resource owner/manager and student dashboards | Supabase-backed, with limits | Dashboard queries use authorized persisted records; do not treat aggregate views as proof that every operational feature is enabled. |
| Saved resources/favourites | Migration-dependent | Requires `20261101040000_resource_archive_favorites.sql`; rows are scoped to the signed-in user by RLS. |
| Theme and navigation preferences | Browser-local by design | These are UI preferences, not institutional business data. |

Database failures must remain visible as errors. Do not restore demo fallbacks
or report a successful mutation before Supabase confirms it.

## Reservation behavior and feature flags

`RESERVATION_CONTROLS_ENABLED` remains disabled by default. Keep it disabled
until `20261101020000_reservation_controls.sql` and its dependencies are
applied and verified on the intended database. The legacy four-argument
booking RPC remains the compatibility path otherwise.

The reservation-control defaults are independent: three active reservations
per user, and two distinct overlapping resources per user. Institutional
administrators can configure limits. Intervals use `[start, end)`, so adjacent
bookings are allowed. The availability/waiting-list RPC migration remains a
separate prerequisite for those UI workflows; do not infer availability or
queue position from a failed database request.

## Prepared migrations

No migration was applied to production as part of this implementation. The
prepared local changes, in dependency order, are:

1. `20261101000000_update_institution_name.sql`
2. `20261101010000_membership_review_notifications.sql`
3. `20261101020000_reservation_controls.sql`
4. `20261101030000_availability_waiting_list.sql`
5. `20261101040000_resource_archive_favorites.sql`
6. `20261101050000_notification_delivery.sql`

Before any deployment, reconcile every migration against the target's actual
history and schema. Skip versions already applied; do not replay existing
migrations. The archive/favourites migration preserves historical records and
adds archive/restore audit events. The delivery migration adds a private
scheduled-event ledger, opt-in channel preferences, push subscriptions, and
retryable delivery jobs; it also schedules deduplicated start, return and
overdue reminders and notifies users when waiting-list entries are offered.

## Notification delivery operations

Outbound delivery is optional and requires all of:

- The notification-delivery migration on the selected database.
- A `CRON_SECRET` of at least 32 characters and server-only
  `SUPABASE_SERVICE_ROLE_KEY`.
- Resend configuration (`RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`) for
  email and/or VAPID configuration (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) for push.
- The scheduled `/api/cron/notifications` endpoint. `vercel.json` requests it
  every five minutes; hosting-provider scheduling and secrets still need to
  be configured and verified.

The API uses bounded batches, database job claiming, retry/backoff, and
provider idempotency where supported. Provider delivery has not been verified
by this local implementation. Do not claim email or push delivery is active
until a non-production end-to-end test succeeds.

## Validation and limitations

Run application checks with:

```powershell
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Run `supabase test db` only against a disposable local or staging database
after verifying the Supabase CLI is configured for that target. The SQL suites
use pgTAP under `supabase/tests/`; they have not been run unless a test result
is explicitly recorded for the current change. Never point test fixtures at
production, run `supabase db push` automatically, disable RLS, or import old
browser-local demo records.

Automated SQL behavior and outbound provider delivery remain unverified when
local PostgreSQL/Supabase tooling or provider credentials are unavailable.
