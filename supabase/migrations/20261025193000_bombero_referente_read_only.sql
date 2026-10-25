-- Bombero Referente: perfil autenticado estrictamente de consulta.
-- No concede INSERT/UPDATE/DELETE. Las políticas administrativas existentes permanecen intactas.
insert into public.app_roles (role_key, nombre, descripcion)
values ('bombero_referente', 'Bombero Referente', 'Consulta de controles, personal, anomalías e inventario de extintores; sin edición ni movimientos')
on conflict (role_key) do update
set nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into public.app_permissions (permission_key, descripcion) values
 ('activos.read', 'Consultar activos e inventario'),
 ('controles.read', 'Consultar historial de controles'),
 ('anomalias.read', 'Consultar anomalías'),
 ('personal.read', 'Consultar personal de Bomberos'),
 ('pulmon.read', 'Consultar inventario del Pulmón y recargas')
on conflict (permission_key) do nothing;

insert into public.app_role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.app_permissions p on p.permission_key in
 ('activos.read','controles.read','anomalias.read','personal.read','pulmon.read')
where r.role_key = 'bombero_referente'
on conflict do nothing;

-- Mantener el rol de referente por debajo de roles de gestión en la resolución principal.
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
    when 'bombero_referente' then 5 when 'bombero_inspector' then 6
    when 'bomberos' then 7 else 99 end
  limit 1;
$$;
revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- Lectura autenticada de los módulos operativos existentes. La lista incluye tablas de
-- controles e inventarios conocidas; los nombres de Pulmón/Vertolez se contemplan si existen.
do $$
declare t text;
begin
  foreach t in array array[
    'leu','Extintores','hidrantes','ecas','vecas','Valvulas','pecas','Bomberos','inicio','ipp',
    'controles_e','controles_h','controles_ecas','controles_vecas','controles_v','controles_pecas',
    'controles_pfp','controles_c','controles_pc','controles_es','anomalias',
    'pulmon','pulmon_extintores','pulmon_alveolos','pulmon_movimientos','alveolos_pulmon',
    'movimientos_pulmon','Movimientos_Pulmon','Inspecciones_extintores',
    'extintores_pulmon','extintores_vertoles','extintores_bertoles','bertoles','Vertolez','Bertolez'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('grant select on table public.%I to authenticated', t);
      execute format('drop policy if exists %I on public.%I', t || '_referente_read', t);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.current_user_has_role(''bombero_referente''))',
        t || '_referente_read', t
      );
    end if;
  end loop;
end $$;
