# ResourceHub

ResourceHub is a Next.js App Router prototype for discovering, requesting, and managing shared institutional equipment and spaces.

## Run locally

Requirements: Node.js 20+ and Corepack (included with Node.js).

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks and production commands:

```powershell
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm start
```

The project is pinned to pnpm 12.3.4 in `package.json` and should be installed with the existing `pnpm-lock.yaml`.

## Current functionality

- Browse fictional sample resources and view resource details.
- Register and sign in with Supabase Auth; registration creates a pending institution membership request after email confirmation.
- Create, edit, publish, and save draft resource listings in the current browser.
- Submit booking requests, review decisions, and prevent conflicting approvals within the current browser state.
- Record check-out and check-in condition reports, and report and update incidents.
- Persist demo resources, bookings, activity, and waitlist entries in browser `localStorage`.

## Prototype limitations

This is not yet a production-ready institutional platform. Login and registration use Supabase Auth, and Auth sessions are verified server-side. Registration requests only a pending institution membership; it never grants a role. Student and owner workspaces are currently blocked after sign-in because their booking, resource, and incident workflows still use fictional browser-local demo data. Public catalogue pages also show fictional sample resources. There is no verified training/eligibility workflow. Browser `localStorage` is editable and isolated to one browser profile, so it does not share records across users/devices and is not suitable for real personal or institutional data. Booking conflict checks and the waitlist are client-side prototypes, not concurrency-safe shared operations. Notifications are demo records and do not send or display real alerts. Automatic waitlist allocation, scheduled overdue handling, and background reminders are not implemented.

Do not treat demo data or public sample resources as real institutional records. Do not collect real booking or incident information until the corresponding database workflows and authorization policies are implemented.

## Deploying the current demo

The Next.js app can be deployed to Vercel as a demo:

1. Push the project to a Git provider and import it into Vercel.
2. Keep the framework preset as Next.js and use the existing pnpm lockfile.
3. Use `corepack pnpm run build` as the build command; Vercel normally detects the Next.js output directory.
4. Deploy and test the generated URL, including direct refreshes on nested routes.

This deploys the current prototype. Authenticated account creation and sessions are enabled, but shared booking/resource data and production-ready multi-user workflows are not. Configure the Supabase Auth site URL and redirect allowlist to include the deployed `/auth/callback` URL before using registration there.

## Supabase client setup

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` for local development and in your hosting provider for deployment. Restart the Next.js development server after changing local environment variables. The browser client uses only the publishable key; no service-role key is needed or read by these utilities.

The browser and server clients use only the URL and publishable key; no service-role key is needed. Auth callback handling exchanges the verification code, then submits a pending membership request through the signed-in user's RLS permissions. The `/auth/status` page shows the current user's own profile and membership state. Student and owner routes verify the Auth session server-side and remain blocked until their backend workflows are ready. Existing `localStorage` demo records are neither imported nor cleared. During local development only, `GET /api/dev/supabase-connection` runs a read-only, zero-row query using the server client. It checks `SUPABASE_CONNECTION_TEST_TABLE`, defaulting to `resourcehub_connection_test`. A successful response means Supabase answered and that table is accessible; `missing_table` means the request reached Supabase but the table was not found. The endpoint returns 404 outside development and does not create or change data.

## Reset demo data

In the browser developer tools, run:

```js
localStorage.removeItem('resourcehub-demo-v2')
location.reload()
```

This restores the fictional seed data in that browser profile.
