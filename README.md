# ResourceHub

ResourceHub is a Next.js 16 App Router application for discovering and managing
shared institutional equipment and spaces. It uses React, TypeScript, Supabase
Auth, and PostgreSQL with row-level security.

## Run locally

Requirements: Node.js 20+ and Corepack (included with Node.js).

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks and production commands:

```powershell
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm start
```

The project is pinned to pnpm 12.3.4 in `package.json`; use the checked-in
`pnpm-lock.yaml`.

## Supabase setup

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
`.env.local` for local development and in the hosting provider for deployment.
The browser client uses only the publishable key. Never expose a service-role
key in browser code.

Auth callbacks exchange the verification code, and new applicants create
pending institution memberships. A requested role is not an authorization
grant. Server-side route and action checks use the authenticated session,
active membership and approved institution role; database RLS remains
enabled. Memberships use `public.institution_memberships`.

The development-only `GET /api/dev/supabase-connection` endpoint performs a
read-only, zero-row query using the server client. It is not available outside
development and does not create or change data.

## Persisted workflows

Resource discovery and listings, resource management, bookings and booking
decisions, handover condition reports, incident records and events, activity
history, institution membership operations, in-app notifications, saved
resources, and favourites use Supabase-backed reads or mutations with their
existing server authorization and database policies.

The former shared browser demo store and seeded business records have been
removed. Theme and navigation preferences may remain browser-local; they are
not business records. Database errors are shown as errors rather than
substituted with demo records.

Availability conflict checks and waiting-list workflows require
`20261101030000_availability_waiting_list.sql`. Until that migration is
applied and verified, those controls report that they are unavailable; they
do not fabricate queue positions or treat a failed query as an open slot.
Booking creation continues to use the existing four-argument RPC unless the
reservation-control flag is explicitly enabled after the corresponding schema
is verified.

Email and browser push delivery require the notification-delivery migration,
provider configuration, and the protected scheduled endpoint. They are
optional and are not considered operational until configured and tested.
In-app notifications remain separate from outbound delivery.

## Database migrations

The migrations below are prepared locally; this work has not applied them to
any database. Before deployment, inspect the target project's migration
history and compare every file with the exact target. Apply only migrations
that are actually pending, in timestamp order, after confirming their
dependencies:

1. `20261101000000_update_institution_name.sql`
2. `20261101010000_membership_review_notifications.sql`
3. `20261101020000_reservation_controls.sql`
4. `20261101030000_availability_waiting_list.sql`
5. `20261101040000_resource_archive_favorites.sql`
6. `20261101050000_notification_delivery.sql`

Do not replay already-applied migrations or apply these blindly to production.
The reservation-control migration keeps the confirmed-booking exclusion
constraint and existing public discovery grants and policies. Its independent
institution settings default to 3 active reservations and 2 distinct
overlapping resources per user. Time intervals are half-open `[start, end)`;
adjacent bookings do not overlap. It adds atomic idempotency, persistent rate
limiting, and administrator-managed limits. The availability migration adds
privacy-scoped conflict checks and persistent waiting-list operations.

`RESERVATION_CONTROLS_ENABLED` defaults to disabled. Do not set it to `true`
until the reservation-control migration and required predecessors have been
applied and verified on the target database. The application otherwise keeps
the existing booking RPC compatibility path.

The archive/favourites migration preserves resources and booking history,
prevents physical resource deletion, records archive/restore activity, and
adds user-owned saved-resource rows with RLS. The notification migration adds
opt-in channel preferences, push subscriptions, a bounded/retryable delivery
queue, deduplicated booking reminders, and waiting-list offer notifications.
Email uses Resend; web push uses VAPID. The scheduled endpoint is configured
for Vercel every five minutes and rejects requests without a sufficiently long
`CRON_SECRET`.

Run SQL migration tests only against a disposable local or staging database:

```powershell
supabase start
supabase db reset
supabase test db
```

These commands require the Supabase CLI and Docker and must be run only after
checking the CLI is targeting the local stack. The pgTAP tests are under
`supabase/tests/`. Do not use `supabase db push` as a substitute for review.

## Notification delivery configuration

The optional server-side configuration is listed, without values, in
`.env.example`:

- `CRON_SECRET` (at least 32 characters)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` for email
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
  for browser push

Keep all secret values in the hosting provider's secret manager or an
untracked `.env.local`; never commit them. Configure browser push only over
HTTPS and verify delivery in a non-production environment first.
