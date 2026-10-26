-- Restringe las funciones de autorización durante el cambio obligatorio de contraseña.
-- La bandera vive en app_metadata (solo modificable por administración), nunca en user_metadata.
create or replace function public.current_user_must_change_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select (u.raw_app_meta_data ->> 'must_change_password')::boolean
    from auth.users u
    where u.id = (select auth.uid())
  ), false);
$function$;

revoke all on function public.current_user_must_change_password() from public;
grant execute on function public.current_user_must_change_password() to authenticated;

create or replace function public.current_user_has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select not public.current_user_must_change_password()
    and exists (
      select 1
      from public.app_user_roles ur
      join public.app_roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.role_key = p_role
    );
$function$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select r.role_key
  from public.app_user_roles ur
  join public.app_roles r on r.id = ur.role_id
  where ur.user_id = (select auth.uid())
    and not public.current_user_must_change_password()
  order by case r.role_key
    when 'superadministrador' then 1 when 'administrador' then 2
    when 'supervisor' then 3 when 'mantenimiento' then 4
    when 'bombero_referente' then 5 when 'bombero_inspector' then 6
    when 'bomberos' then 7 else 99 end
  limit 1;
$function$;

create or replace function public.current_user_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select not public.current_user_must_change_password()
    and exists (
      select 1
      from public.app_user_roles ur
      join public.app_role_permissions rp on rp.role_id = ur.role_id
      join public.app_permissions p on p.id = rp.permission_id
      join public.app_user_profiles up on up.user_id = ur.user_id
      where ur.user_id = auth.uid()
        and up.activo is true
        and p.permission_key = p_permission
    );
$function$;
