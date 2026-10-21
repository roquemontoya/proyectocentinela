-- Administración segura de cuentas Centinela 2.0
-- Aditiva: no borra usuarios ni modifica tablas operativas.
insert into public.app_roles (role_key, nombre, descripcion) values
 ('supervisor','Supervisor','Supervisión de operaciones y recorridos'),
 ('bombero_inspector','Bombero/Inspector','Inspección y registro de controles'),
 ('mantenimiento','Mantenimiento','Gestión de tareas y novedades de mantenimiento')
on conflict (role_key) do update set nombre=excluded.nombre, descripcion=excluded.descripcion;

insert into public.app_role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.app_permissions p on p.permission_key in (
  'activos.read','controles.read','controles.create','anomalias.read','anomalias.create','pulmon.read','personal.read'
)
where r.role_key in ('bombero_inspector','bomberos')
on conflict do nothing;

insert into public.app_role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.app_permissions p on p.permission_key in (
  'activos.read','activos.update','controles.read','controles.create','controles.update',
  'anomalias.read','anomalias.create','anomalias.resolve','ubicaciones.update','personal.read','personal.manage','pulmon.read','pulmon.update'
)
where r.role_key='mantenimiento'
on conflict do nothing;

insert into public.app_role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.app_permissions p on p.permission_key in (
  'activos.read','controles.read','controles.create','controles.update','anomalias.read',
  'anomalias.create','anomalias.resolve','ubicaciones.update','personal.read','pulmon.read'
)
where r.role_key='supervisor'
on conflict do nothing;

create table if not exists public.app_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  legajo text,
  telefono text,
  activo boolean not null default true,
  notas text,
  creado_por uuid references auth.users(id) on delete set null,
  actualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_user_profiles_nombre_nonempty check (length(trim(nombre_completo)) > 0)
);
create unique index if not exists app_user_profiles_legajo_unique on public.app_user_profiles(legajo) where legajo is not null and trim(legajo) <> '';

create table if not exists public.app_user_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists app_user_audit_target_created_idx on public.app_user_audit(target_user_id, created_at desc);

create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select r.role_key
  from public.app_user_roles ur
  join public.app_roles r on r.id=ur.role_id
  where ur.user_id=(select auth.uid())
  order by case r.role_key
    when 'superadministrador' then 1 when 'administrador' then 2
    when 'supervisor' then 3 when 'mantenimiento' then 4
    when 'bombero_inspector' then 5 when 'bomberos' then 6 else 99 end
  limit 1;
$$;
revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- Solo service_role puede consultar el rol de un usuario arbitrario; lo usa la Edge Function.
create or replace function public.current_user_role_for_id(p_user_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select r.role_key
  from public.app_user_roles ur
  join public.app_roles r on r.id=ur.role_id
  where ur.user_id=p_user_id
  order by case r.role_key
    when 'superadministrador' then 1 when 'administrador' then 2
    when 'supervisor' then 3 when 'mantenimiento' then 4
    when 'bombero_inspector' then 5 when 'bomberos' then 6 else 99 end
  limit 1;
$$;
revoke all on function public.current_user_role_for_id(uuid) from public, anon, authenticated;
grant execute on function public.current_user_role_for_id(uuid) to service_role;

alter table public.app_user_profiles enable row level security;
alter table public.app_user_audit enable row level security;
revoke all on public.app_user_profiles from anon, authenticated;
revoke all on public.app_user_audit from anon, authenticated;
grant select on public.app_user_profiles to authenticated;
grant select on public.app_user_audit to authenticated;

drop policy if exists app_user_profiles_read_self_or_admin on public.app_user_profiles;
create policy app_user_profiles_read_self_or_admin on public.app_user_profiles
for select to authenticated
using (user_id=(select auth.uid()) or public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador'));

drop policy if exists app_user_audit_read_admin on public.app_user_audit;
create policy app_user_audit_read_admin on public.app_user_audit
for select to authenticated
using (public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador'));

-- El panel escribe perfiles, roles y auditoría exclusivamente mediante Edge Function.
