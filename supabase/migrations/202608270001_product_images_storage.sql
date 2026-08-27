-- Create storage bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760, -- 10MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
);

-- Allow admin (service_role) to upload
create policy "Admin can upload product images"
on storage.objects
for insert
to service_role
with check (bucket_id = 'product-images');

-- Allow admin to delete product images
create policy "Admin can delete product images"
on storage.objects
for delete
to service_role
using (bucket_id = 'product-images');

-- Allow public read access
create policy "Public can view product images"
on storage.objects
for select
using (bucket_id = 'product-images');
