-- =====================================================================
-- Elite Shop — Promover o PRIMEIRO administrador
-- 1) Crie a conta normalmente (pela app Android ou em Authentication > Users).
-- 2) Substitua o e-mail abaixo e execute no SQL Editor (corre como postgres).
-- Depois disso, novos admins/operadores são geridos no painel (Clientes).
-- =====================================================================
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
  from auth.users u
 where lower(u.email) = lower('SUBSTITUIR_PELO_EMAIL_DO_ADMIN@exemplo.com')
on conflict (user_id, role) do nothing;

-- Verificação
select u.email, array_agg(r.role) as roles
  from auth.users u join public.user_roles r on r.user_id = u.id
 where lower(u.email) = lower('SUBSTITUIR_PELO_EMAIL_DO_ADMIN@exemplo.com')
 group by u.email;
