begin;

create table if not exists public.rate_limit_buckets (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (length(btrim(scope)) between 1 and 100),
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (actor_id, scope, window_started_at)
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated, service_role;

create or replace function resourcehub_private.consume_rate_limit(
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_window timestamptz;
  v_attempts integer;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or length(btrim(p_scope)) < 1 then
    raise exception 'Invalid rate limit configuration.' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_buckets (actor_id, scope, window_started_at, attempts)
  values (v_actor, p_scope, v_window, 1)
  on conflict (actor_id, scope, window_started_at)
  do update set attempts = public.rate_limit_buckets.attempts + 1
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

revoke all on function resourcehub_private.consume_rate_limit(text, integer, integer) from public, anon, authenticated, service_role;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select resourcehub_private.consume_rate_limit(p_scope, p_limit, p_window_seconds);
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

commit;
