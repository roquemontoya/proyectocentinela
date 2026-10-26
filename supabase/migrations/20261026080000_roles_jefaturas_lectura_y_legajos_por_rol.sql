-- Perfiles de jefatura administrativa: consulta, exportación y estadísticas futuras; sin permisos de escritura.
insert into public.app_roles (role_key,nombre,descripcion) values
('jefe_seguridad_patrimonial','Jefe de Seguridad Patrimonial','Solo lectura de información operativa, exportaciones y estadísticas'),
('jefe_guardia_fisica','Jefe de Guardia Física','Solo lectura de información operativa, exportaciones y estadísticas'),
('jefe_prevencion_incendios','Jefe de Prevención de Incendios','Solo lectura de información operativa, exportaciones y estadísticas'),
('jefe_rhp','Jefe de RHP','Solo lectura de información operativa, exportaciones y estadísticas'),
('gerencia','Gerencia','Solo lectura de información operativa, exportaciones y estadísticas')
on conflict (role_key) do update set nombre=excluded.nombre, descripcion=excluded.descripcion;

insert into public.app_permissions (permission_key,descripcion) values
('activos.export','Exportar información de activos'),
('estadisticas.read','Consultar estadísticas e informes')
on conflict (permission_key) do nothing;

insert into public.app_role_permissions (role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.app_permissions p
where r.role_key in ('jefe_seguridad_patrimonial','jefe_guardia_fisica','jefe_prevencion_incendios','jefe_rhp','gerencia')
and p.permission_key in ('activos.read','controles.read','anomalias.read','personal.read','pulmon.read','activos.export','estadisticas.read')
on conflict do nothing;

do $$
declare t text;
begin
  foreach t in array array[
    'leu','Extintores','hidrantes','ecas','vecas','Valvulas','pecas','Bomberos','inicio','ipp',
    'controles_e','controles_h','controles_ecas','controles_vecas','controles_v','controles_pecas',
    'controles_pfp','controles_c','controles_pc','controles_es','anomalias',
    'extintores_trazabilidad','movimientos_extintores','movimientos_reemplazos_extintores','reemplazos_temporales_extintores',
    'pulmon','pulmon_extintores','pulmon_alveolos','pulmon_movimientos','alveolos_pulmon',
    'movimientos_pulmon','Movimientos_Pulmon','Inspecciones_extintores',
    'extintores_pulmon','extintores_vertoles','extintores_bertoles','bertoles','Vertolez','Bertolez'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('grant select on table public.%I to authenticated', t);
      execute format('drop policy if exists %I on public.%I', t || '_jefaturas_read', t);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.current_user_role() in (''jefe_seguridad_patrimonial'',''jefe_guardia_fisica'',''jefe_prevencion_incendios'',''jefe_rhp'',''gerencia''))',
        t || '_jefaturas_read', t
      );
    end if;
  end loop;
end $$;

create or replace function private.asignar_legajo_primer_ingreso()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_nombre text;
  v_legajo text;
  v_role text;
  v_inicio bigint;
  v_fin bigint;
  v_n bigint;
begin
  if new.last_sign_in_at is null or old.last_sign_in_at is not null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('centinela_legajo_sequence'));
  v_nombre := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nombre_completo','')), '');
  if v_nombre is null then v_nombre := coalesce(nullif(split_part(coalesce(new.email,''),'@',1),''),'Usuario Centinela'); end if;
  insert into public.app_user_profiles(user_id,nombre_completo,legajo,activo)
  values(new.id,v_nombre,null,true) on conflict(user_id) do nothing;

  select p.legajo into v_legajo from public.app_user_profiles p where p.user_id=new.id for update;
  if v_legajo is not null and trim(v_legajo)<>'' then return new; end if;

  select r.role_key into v_role
  from public.app_user_roles ur join public.app_roles r on r.id=ur.role_id
  where ur.user_id=new.id order by case r.role_key
    when 'superadministrador' then 1 when 'administrador' then 2 when 'mantenimiento' then 3
    when 'jefe_seguridad_patrimonial' then 4 when 'jefe_guardia_fisica' then 5
    when 'jefe_prevencion_incendios' then 6 when 'jefe_rhp' then 7 when 'gerencia' then 8
    when 'supervisor' then 9 when 'bombero_referente' then 10 when 'bombero_inspector' then 11
    when 'bomberos' then 12 else 99 end limit 1;

  case v_role
    when 'superadministrador' then v_inicio:=0; v_fin:=9;
    when 'administrador' then v_inicio:=10; v_fin:=29;
    when 'mantenimiento' then v_inicio:=30; v_fin:=49;
    when 'jefe_seguridad_patrimonial' then v_inicio:=50; v_fin:=69;
    when 'jefe_guardia_fisica' then v_inicio:=70; v_fin:=89;
    when 'jefe_prevencion_incendios' then v_inicio:=90; v_fin:=109;
    when 'jefe_rhp' then v_inicio:=110; v_fin:=129;
    when 'gerencia' then v_inicio:=130; v_fin:=149;
    when 'supervisor' then v_inicio:=150; v_fin:=179;
    when 'bombero_referente' then v_inicio:=180; v_fin:=229;
    when 'bombero_inspector' then v_inicio:=230; v_fin:=999;
    when 'bomberos' then v_inicio:=1000; v_fin:=1999;
    else v_inicio:=2000; v_fin:=999999;
  end case;

  v_n:=v_inicio;
  while v_n<=v_fin loop
    v_legajo:=case when v_n<=999 then lpad(v_n::text,3,'0') else v_n::text end;
    exit when not exists(select 1 from public.app_user_profiles p where p.legajo=v_legajo and p.user_id<>new.id);
    v_n:=v_n+1;
  end loop;
  if v_n>v_fin then raise exception 'No quedan legajos disponibles para el rol % (rango %-%).',v_role,v_inicio,v_fin; end if;
  update public.app_user_profiles set legajo=v_legajo,nombre_completo=v_nombre,updated_at=now()
  where user_id=new.id and (legajo is null or trim(legajo)='');
  return new;
end;
$$;
revoke all on function private.asignar_legajo_primer_ingreso() from public,anon,authenticated;
