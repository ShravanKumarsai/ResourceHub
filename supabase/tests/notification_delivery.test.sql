begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000009701', 'authenticated', 'authenticated',
    'notification-delivery-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009702', 'authenticated', 'authenticated',
    'notification-delivery-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000009707', 'authenticated', 'authenticated',
    'notification-delivery-student@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.institutions (id, name, slug)
values ('00000000-0000-4000-8000-000000009703', 'Notification Test', 'notification-test');

insert into public.institution_memberships (
  id, institution_id, user_id, status, reviewed_at, verified_at
)
values
  ('00000000-0000-4000-8000-000000009708',
    '00000000-0000-4000-8000-000000009703',
    '00000000-0000-4000-8000-000000009702', 'active', now(), now()),
  ('00000000-0000-4000-8000-000000009709',
    '00000000-0000-4000-8000-000000009703',
    '00000000-0000-4000-8000-000000009707', 'active', now(), now());

insert into public.institution_membership_roles (membership_id, role)
values
  ('00000000-0000-4000-8000-000000009708', 'resource_owner'),
  ('00000000-0000-4000-8000-000000009709', 'student');

insert into public.resources (
  id, institution_id, owner_membership_id, owner_user_id, name, category,
  location, description, approval_mode, listed
)
values (
  '00000000-0000-4000-8000-000000009710',
  '00000000-0000-4000-8000-000000009703',
  '00000000-0000-4000-8000-000000009708',
  '00000000-0000-4000-8000-000000009702',
  'Notification test resource', 'Equipment', 'Test lab',
  'A test resource with sufficient description length.', 'owner', true
);

insert into public.bookings (
  id, institution_id, resource_id, requester_membership_id, requester_user_id,
  starts_at, ends_at, purpose, status
)
values
  (
    '00000000-0000-4000-8000-000000009711',
    '00000000-0000-4000-8000-000000009703',
    '00000000-0000-4000-8000-000000009710',
    '00000000-0000-4000-8000-000000009709',
    '00000000-0000-4000-8000-000000009707',
    now() + interval '2 hours', now() + interval '3 hours',
    'Upcoming booking notification test', 'approved'
  ),
  (
    '00000000-0000-4000-8000-000000009712',
    '00000000-0000-4000-8000-000000009703',
    '00000000-0000-4000-8000-000000009710',
    '00000000-0000-4000-8000-000000009709',
    '00000000-0000-4000-8000-000000009707',
    now() - interval '1 hour', now() + interval '30 minutes',
    'Upcoming return notification test', 'in_use'
  ),
  (
    '00000000-0000-4000-8000-000000009713',
    '00000000-0000-4000-8000-000000009703',
    '00000000-0000-4000-8000-000000009710',
    '00000000-0000-4000-8000-000000009709',
    '00000000-0000-4000-8000-000000009707',
    now() - interval '3 hours', now() - interval '2 hours',
    'Overdue return notification test', 'in_use'
  );

insert into public.notification_preferences (user_id, email_enabled, push_enabled)
values ('00000000-0000-4000-8000-000000009701', true, false);

insert into public.notifications (
  id, recipient_id, institution_id, title, body
)
values
  (
    '00000000-0000-4000-8000-000000009704',
    '00000000-0000-4000-8000-000000009701',
    '00000000-0000-4000-8000-000000009703',
    'First notification',
    'Email is enabled for this account.'
  ),
  (
    '00000000-0000-4000-8000-000000009705',
    '00000000-0000-4000-8000-000000009702',
    '00000000-0000-4000-8000-000000009703',
    'Second notification',
    'No delivery preferences were created for this user.'
  );

select is(
  (select count(*)::integer
   from public.notification_delivery_jobs
   where notification_id = '00000000-0000-4000-8000-000000009704'),
  1,
  'only opted-in channels receive a delivery job'
);

select is(
  (select count(*)::integer
   from public.notification_delivery_jobs
   where notification_id = '00000000-0000-4000-8000-000000009705'),
  0,
  'users without preferences do not receive outbound jobs'
);

update public.notification_preferences
set push_enabled = true
where user_id = '00000000-0000-4000-8000-000000009701';

insert into public.notifications (
  id, recipient_id, institution_id, title, body
)
values (
  '00000000-0000-4000-8000-000000009706',
  '00000000-0000-4000-8000-000000009701',
  '00000000-0000-4000-8000-000000009703',
  'Two channel notification',
  'Email and push outcomes are stored separately.'
);

select is(
  (select count(*)::integer
   from public.notification_delivery_jobs
   where notification_id = '00000000-0000-4000-8000-000000009706'),
  2,
  'email and push use separate idempotent jobs'
);

select ok(
  has_table_privilege('authenticated', 'public.notification_preferences', 'SELECT')
  and not has_table_privilege('authenticated', 'public.notification_preferences', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.notification_push_subscriptions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.notification_delivery_jobs', 'SELECT'),
  'authenticated users can only read their own preferences directly'
);

select ok(
  (select relation.relrowsecurity
   from pg_catalog.pg_class as relation
   where relation.oid = 'public.notifications'::regclass)
  and exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'notifications'
      and policy.policyname = 'Users can read their own notifications'
  )
  and exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'notifications'
      and policy.policyname = 'Users can update their own notification read time'
  ),
  'The delivery migration preserves the existing in-app notification RLS policies'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.upsert_notification_push_subscription(text, text, text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.delete_notification_push_subscription(text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.claim_notification_delivery_jobs(text[], integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.claim_notification_delivery_jobs(text[], integer)',
    'EXECUTE'
  ),
  'subscription mutations are authenticated and queue claims are service-only'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009701', true);

select is(
  (select count(*)::integer from public.notification_preferences),
  1,
  'users can read only their own notification preferences'
);

select is(
  (select count(*)::integer from public.notifications),
  1,
  'the existing in-app notification list remains scoped to the authenticated recipient'
);
select is(
  (with updated as (
     update public.notifications
     set read_at = now()
     where recipient_id = '00000000-0000-4000-8000-000000009702'
     returning id
   )
   select count(*)::integer from updated),
  0,
  'a user cannot change another recipient’s in-app notification'
);
select lives_ok(
  $$update public.notifications
    set read_at = now()
    where id = '00000000-0000-4000-8000-000000009704'$$,
  'a user can mark their own in-app notification as read'
);

select lives_ok(
  $$select public.upsert_notification_push_subscription(
    'https://fcm.googleapis.com/fcm/send/test-endpoint',
    repeat('A', 87),
    repeat('B', 22)
  )$$,
  'authenticated user can create a push subscription for their own account'
);

select throws_ok(
  $$select public.upsert_notification_push_subscription(
    'https://attacker.example.invalid/push',
    repeat('A', 87),
    repeat('B', 22)
  )$$,
  '22023',
  'unsupported_push_endpoint',
  'push endpoints are restricted to recognized provider domains'
);

select throws_ok(
  $$select * from public.notification_push_subscriptions$$,
  '42501',
  null,
  'browser roles cannot directly read push endpoint credentials'
);

reset role;

select is(
  (select count(*)::integer
   from public.notification_push_subscriptions
   where user_id = '00000000-0000-4000-8000-000000009701'),
  1,
  'subscription RPC records the authenticated user as owner'
);

select is(
  (select count(*)::integer
   from public.claim_notification_delivery_jobs(array['email']::text[], 25)),
  2,
  'claim routine returns only requested channels'
);

select is(
  (select count(*)::integer
   from public.claim_notification_delivery_jobs(array['push']::text[], 25)),
  1,
  'claim routine independently returns push jobs'
);

select throws_ok(
  $$select * from public.claim_notification_delivery_jobs(array['email']::text[], 26)$$,
  '22023',
  'batch_limit_out_of_range',
  'delivery batches are hard-bounded'
);

select is(
  public.finish_notification_delivery_job(
    '00000000-0000-4000-8000-000000009706'::uuid,
    'sent',
    null,
    'resend-message-id'
  ),
  true,
  'email outcome can be finalized independently'
);

select is(
  public.finish_notification_delivery_job(
    (
      select id
      from public.notification_delivery_jobs
      where notification_id = '00000000-0000-4000-8000-000000009706'
        and channel = 'push'
    ),
    'retry',
    'push_delivery_failed',
    null
  ),
  true,
  'push outcome can be retried independently'
);

select is(
  (select status from public.notification_delivery_jobs
   where notification_id = '00000000-0000-4000-8000-000000009706'
     and channel = 'email'),
  'sent',
  'email status is persisted separately'
);

select is(
  (select status from public.notification_delivery_jobs
   where notification_id = '00000000-0000-4000-8000-000000009706'
     and channel = 'push'),
  'pending',
  'failed push attempt is scheduled for retry'
);

select is(
  (select attempts from public.notification_delivery_jobs
   where notification_id = '00000000-0000-4000-8000-000000009706'
     and channel = 'push'),
  1::smallint,
  'delivery attempt count is persisted'
);

select is(
  public.queue_scheduled_booking_notifications(),
  4,
  'scheduler creates idempotent start, return, and overdue notices for requester and owner'
);

select is(
  public.queue_scheduled_booking_notifications(),
  0,
  'scheduler does not create duplicate reminder notifications'
);

select is(
  (select count(*)::integer
   from public.notifications
   where recipient_id = '00000000-0000-4000-8000-000000009707'
     and title in (
       'Booking starts soon',
       'Booking ends soon',
       'Resource return overdue'
     )),
  3,
  'in-app start, return, and overdue reminders are persisted'
);

select is(
  (select count(*)::integer
   from public.notifications
   where recipient_id = '00000000-0000-4000-8000-000000009702'
     and title = 'Resource return overdue'),
  1,
  'resource owner receives an overdue-return notice'
);

insert into public.waiting_list_entries (
  institution_id, resource_id, requester_membership_id, requester_user_id,
  starts_at, ends_at
)
values (
  '00000000-0000-4000-8000-000000009703',
  '00000000-0000-4000-8000-000000009710',
  '00000000-0000-4000-8000-000000009709',
  '00000000-0000-4000-8000-000000009707',
  now() + interval '4 hours',
  now() + interval '5 hours'
);

update public.waiting_list_entries
set status = 'offered'
where requester_user_id = '00000000-0000-4000-8000-000000009707'
  and resource_id = '00000000-0000-4000-8000-000000009710';

select is(
  (select count(*)::integer
   from public.notifications
   where recipient_id = '00000000-0000-4000-8000-000000009707'
     and title = 'Waiting-list offer'),
  1,
  'wait-list offer transitions create an in-app notification'
);

select * from finish();
rollback;
