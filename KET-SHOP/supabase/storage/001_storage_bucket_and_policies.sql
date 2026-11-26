-- =====================================================================
-- Elite Shop — Storage privado para comprovativos
-- Caminho obrigatório:  payment-proofs/<user_id>/<order_id>/<ficheiro>.<jpg|jpeg|png|webp>
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ketshop proofs insert own" on storage.objects;
drop policy if exists "ketshop proofs select own or staff" on storage.objects;
drop policy if exists "ketshop proofs delete admin" on storage.objects;

-- Cliente só pode carregar para a sua pasta e para uma encomenda sua que aceite comprovativo
create policy "ketshop proofs insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_upload_proof((storage.foldername(name))[2])
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
    and array_length(storage.foldername(name), 1) = 2
  );

-- Leitura: o próprio cliente ou a equipa (admin/operator)
create policy "ketshop proofs select own or staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff()))
  );

-- Apenas administradores podem apagar ficheiros. Não existe política de UPDATE:
-- um comprovativo enviado não pode ser substituído/sobrescrito.
create policy "ketshop proofs delete admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));
