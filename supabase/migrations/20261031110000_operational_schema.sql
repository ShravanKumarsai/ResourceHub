create extension if not exists btree_gist with schema extensions;

alter table public.institution_memberships
  add constraint institution_memberships_id_institution_user_key
  unique (id, institution_id, user_id);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  owner_membership_id uuid not null,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  owner_name text not null default 'Resource owner',
  name text not null check (length(btrim(name)) between 1 and 200),
  category text not null check (length(btrim(category)) between 1 and 120),
  location text not null check (length(btrim(location)) between 1 and 240),
  description text not null check (length(btrim(description)) between 20 and 10000),
  image_path text,
  specifications jsonb not null default '[]'::jsonb
    check (jsonb_typeof(specifications) = 'array'),
  highlights text[] not null default '{}',
  availability text not null default 'available'
    check (availability in ('available', 'limited', 'unavailable')),
  hourly_rate numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  max_duration_hours integer not null default 4 check (max_duration_hours between 1 and 168),
  approval_mode text not null default 'owner'
    check (approval_mode in ('owner', 'automatic')),
  eligibility text[] not null default '{}',
  training text[] not null default '{}',
  safety text[] not null default '{}',
  use_cases text[] not null default '{}',
  instructions text[] not null default '{}',
  listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_owner_membership_fkey
    foreign key (owner_membership_id, institution_id, owner_user_id)
    references public.institution_memberships(id, institution_id, user_id)
    on delete restrict,
  constraint resources_id_institution_key unique (id, institution_id),
  constraint resources_image_path_check
    check (image_path is null or image_path like id::text || '/%')
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  resource_id uuid not null,
  requester_membership_id uuid not null,
  requester_user_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  purpose text not null check (length(btrim(purpose)) between 15 and 5000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'in_use', 'completed')),
  decision_note text check (decision_note is null or length(decision_note) <= 2000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_time_check check (ends_at > starts_at),
  constraint bookings_resource_institution_fkey
    foreign key (resource_id, institution_id)
    references public.resources(id, institution_id) on delete restrict,
  constraint bookings_requester_membership_fkey
    foreign key (requester_membership_id, institution_id, requester_user_id)
    references public.institution_memberships(id, institution_id, user_id)
    on delete restrict,
  constraint bookings_id_institution_key unique (id, institution_id),
  constraint bookings_id_resource_institution_key unique (id, resource_id, institution_id)
);

alter table public.bookings
  add constraint bookings_no_confirmed_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('approved', 'in_use'));

create table public.condition_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  phase text not null check (phase in ('check_out', 'check_in')),
  rating text not null check (rating in ('excellent', 'good', 'minor_wear', 'damaged')),
  notes text not null default '' check (length(notes) <= 2000),
  checklist text[] not null check (cardinality(checklist) > 0),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (booking_id, phase),
  check (rating <> 'damaged' or length(btrim(notes)) >= 10)
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  resource_id uuid not null,
  booking_id uuid,
  reporter_membership_id uuid not null,
  reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  title text not null check (length(btrim(title)) between 3 and 200),
  description text not null check (length(btrim(description)) between 10 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incidents_resource_institution_fkey
    foreign key (resource_id, institution_id)
    references public.resources(id, institution_id) on delete restrict,
  constraint incidents_booking_resource_institution_fkey
    foreign key (booking_id, resource_id, institution_id)
    references public.bookings(id, resource_id, institution_id) on delete restrict,
  constraint incidents_reporter_membership_fkey
    foreign key (reporter_membership_id, institution_id, reporter_user_id)
    references public.institution_memberships(id, institution_id, user_id)
    on delete restrict,
  constraint incidents_id_institution_key unique (id, institution_id)
);

create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null,
  institution_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text check (from_status is null or from_status in ('open', 'investigating', 'resolved')),
  to_status text not null check (to_status in ('open', 'investigating', 'resolved')),
  note text not null default '' check (length(note) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (incident_id, institution_id)
    references public.incidents(id, institution_id) on delete restrict
);

create table public.waiting_list_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  resource_id uuid not null,
  requester_membership_id uuid not null,
  requester_user_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'accepted', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (resource_id, institution_id)
    references public.resources(id, institution_id) on delete restrict,
  foreign key (requester_membership_id, institution_id, requester_user_id)
    references public.institution_memberships(id, institution_id, user_id)
    on delete restrict
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  resource_id uuid,
  booking_id uuid,
  incident_id uuid,
  event_type text not null check (length(btrim(event_type)) between 1 and 80),
  summary text not null check (length(btrim(summary)) between 1 and 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (resource_id, institution_id)
    references public.resources(id, institution_id) on delete restrict,
  foreign key (booking_id, institution_id)
    references public.bookings(id, institution_id) on delete restrict,
  foreign key (incident_id, institution_id)
    references public.incidents(id, institution_id) on delete restrict
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  activity_event_id uuid references public.activity_events(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 160),
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index resources_institution_listed_idx
  on public.resources (institution_id, listed, category);
create index resources_owner_created_idx
  on public.resources (owner_user_id, created_at desc);
create index bookings_requester_created_idx
  on public.bookings (requester_user_id, created_at desc);
create index bookings_resource_status_start_idx
  on public.bookings (resource_id, status, starts_at);
create index condition_reports_booking_recorded_idx
  on public.condition_reports (booking_id, recorded_at desc);
create index incidents_resource_status_created_idx
  on public.incidents (resource_id, status, created_at desc);
create index incidents_reporter_created_idx
  on public.incidents (reporter_user_id, created_at desc);
create index incident_events_incident_created_idx
  on public.incident_events (incident_id, created_at);
create index waiting_list_resource_slot_created_idx
  on public.waiting_list_entries (resource_id, starts_at, created_at)
  where status = 'waiting';
create unique index waiting_list_active_request_unique
  on public.waiting_list_entries (resource_id, requester_user_id, starts_at, ends_at)
  where status in ('waiting', 'offered', 'accepted');
create index activity_events_institution_created_idx
  on public.activity_events (institution_id, created_at desc);
create index activity_events_actor_created_idx
  on public.activity_events (actor_id, created_at desc)
  where actor_id is not null;
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create trigger resources_set_updated_at
before update on public.resources
for each row execute function resourcehub_private.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function resourcehub_private.set_updated_at();

create trigger incidents_set_updated_at
before update on public.incidents
for each row execute function resourcehub_private.set_updated_at();

create trigger waiting_list_entries_set_updated_at
before update on public.waiting_list_entries
for each row execute function resourcehub_private.set_updated_at();
