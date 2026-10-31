insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'resource-images',
  'resource-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
;

create policy "Resource images are publicly readable"
on storage.objects
for select to anon, authenticated
using (bucket_id = 'resource-images');

create policy "Resource owners can upload images to their resources"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'resource-images'
  and name ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$'
  and exists (
    select 1 from public.resources as resource
    where resource.id::text = split_part(storage.objects.name, '/', 1)
      and resource.owner_user_id = (select auth.uid())
      and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
  )
);

create policy "Resource owners can replace images on their resources"
on storage.objects
for update to authenticated
using (
  bucket_id = 'resource-images'
  and exists (
    select 1 from public.resources as resource
    where resource.id::text = split_part(storage.objects.name, '/', 1)
      and resource.owner_user_id = (select auth.uid())
      and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
  )
)
with check (
  bucket_id = 'resource-images'
  and name ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$'
  and exists (
    select 1 from public.resources as resource
    where resource.id::text = split_part(storage.objects.name, '/', 1)
      and resource.owner_user_id = (select auth.uid())
      and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
  )
);

create policy "Resource owners can delete images on their resources"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'resource-images'
  and exists (
    select 1 from public.resources as resource
    where resource.id::text = split_part(storage.objects.name, '/', 1)
      and resource.owner_user_id = (select auth.uid())
      and resourcehub_private.has_active_resource_role(resource.institution_id, 'resource_owner')
  )
);
