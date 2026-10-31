begin;

-- Keep public discovery limited by the existing RLS policies. These grants only
-- permit the specific reads already constrained by listed/active policies.
grant select on public.resources to anon, authenticated;
grant select (id, name, is_active) on public.institutions to anon, authenticated;

commit;
