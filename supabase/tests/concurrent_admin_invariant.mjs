import { execFileSync, spawn } from 'node:child_process'

const ids = {
  institution: '00000000-0000-4000-8000-000000000903',
  adminA: '00000000-0000-4000-8000-000000000901',
  adminB: '00000000-0000-4000-8000-000000000902',
  membershipA: '00000000-0000-4000-8000-000000000911',
  membershipB: '00000000-0000-4000-8000-000000000912',
}

const databaseUrl = process.env.RESOURCEHUB_TEST_DATABASE_URL
let parsedUrl
try {
  parsedUrl = new URL(databaseUrl)
} catch {
  console.error('Set RESOURCEHUB_TEST_DATABASE_URL to the local disposable Supabase database.')
  process.exit(2)
}

if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname) || parsedUrl.port !== '54322') {
  console.error('Only localhost port 54322 is permitted. No database connection was made.')
  process.exit(2)
}

function runPsql(sql, options = {}) {
  return execFileSync(
    'psql',
    ['-X', '-v', 'ON_ERROR_STOP=1', '--dbname', databaseUrl, ...options.args ?? [], '-c', sql],
    { encoding: 'utf8', stdio: options.capture ? 'pipe' : 'ignore' },
  )
}

const setup = `
begin;
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('${ids.adminA}', 'authenticated', 'authenticated',
    'concurrency-admin-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('${ids.adminB}', 'authenticated', 'authenticated',
    'concurrency-admin-b@example.invalid', '', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.institutions (id, name, slug)
values ('${ids.institution}', 'Disposable concurrency test', 'disposable-concurrency-test')
on conflict (id) do update set is_active = true;

insert into public.institution_memberships (
  id, institution_id, user_id, status, reviewed_at, verified_at
)
values
  ('${ids.membershipA}', '${ids.institution}', '${ids.adminA}', 'active', now(), now()),
  ('${ids.membershipB}', '${ids.institution}', '${ids.adminB}', 'active', now(), now())
on conflict (id) do update
set user_id = excluded.user_id,
    status = 'active',
    account_deleted_at = null,
    reviewed_at = now(),
    verified_at = now();

insert into public.institution_membership_roles (membership_id, role)
values
  ('${ids.membershipA}', 'institution_admin'),
  ('${ids.membershipB}', 'institution_admin')
on conflict do nothing;
commit;
`

try {
  runPsql(setup)
} catch {
  console.error('Disposable concurrency fixtures could not be prepared; inspect the local psql error.')
  process.exit(1)
}

const firstSql = `
begin;
update public.institution_memberships
set status = 'revoked'
where id = '${ids.membershipA}';
select pg_catalog.pg_sleep(2);
delete from public.institution_membership_roles
where membership_id = '${ids.membershipA}' and role = 'institution_admin';
commit;
`
const secondSql = `
begin;
update public.institution_memberships
set status = 'revoked'
where id = '${ids.membershipB}';
delete from public.institution_membership_roles
where membership_id = '${ids.membershipB}' and role = 'institution_admin';
commit;
`

function startPsql(sql) {
  return spawn('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '--dbname', databaseUrl, '-c', sql], {
    stdio: 'ignore',
  })
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code))
  })
}

const first = startPsql(firstSql)
const firstExit = waitForExit(first)
await new Promise((resolve) => setTimeout(resolve, 500))
const second = startPsql(secondSql)
const secondExit = waitForExit(second)

let firstStatus
let secondStatus
let timeoutId
try {
  ;[firstStatus, secondStatus] = await Promise.race([
    Promise.all([firstExit, secondExit]),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), 20_000)
    }),
  ])
} catch {
  first.kill()
  second.kill()
  console.error('Concurrent psql sessions failed or timed out.')
  process.exit(1)
} finally {
  clearTimeout(timeoutId)
}

if (firstStatus !== 0 || secondStatus === 0) {
  console.error(
    'Expected one administrator removal to commit and the competing last-administrator removal to fail.',
  )
  process.exit(1)
}

let invariantResult
try {
  invariantResult = runPsql(
    `select count(*)::text || '|' ||
            coalesce(bool_or(membership.id = '${ids.membershipB}'), false)::text
     from public.institution_memberships as membership
     join public.institution_membership_roles as membership_role
       on membership_role.membership_id = membership.id
     where membership.institution_id = '${ids.institution}'
       and membership.status = 'active'
       and membership_role.role = 'institution_admin';`,
    { capture: true, args: ['--no-align', '--tuples-only'] },
  )
} catch {
  console.error('The post-concurrency invariant query failed.')
  process.exit(1)
}

if (!invariantResult.trim().endsWith('1|true')) {
  console.error('The invariant check failed after the concurrent transactions.')
  process.exit(1)
}

console.log('PASS: concurrent removals preserved exactly one active administrator.')
console.log('Reset the disposable local database after completing the test.')
