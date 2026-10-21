-- Centinela 3.0: cerrar acceso anon a datos operativos y aplicar permisos por rol.
create or replace function public.current_user_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from public.app_user_roles ur
    join public.app_role_permissions rp on rp.role_id = ur.role_id
    join public.app_permissions p on p.id = rp.permission_id
    join public.app_user_profiles up on up.user_id = ur.user_id
    where ur.user_id = auth.uid() and up.activo is true and p.permission_key = p_permission
  );
$$;
revoke all on function public.current_user_has_permission(text) from public, anon;
grant execute on function public.current_user_has_permission(text) to authenticated, service_role;

do $$
declare pol record;
begin
  for pol in select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and ('anon'=any(roles) or 'public'=any(roles))
  loop execute format('drop policy if exists %I on %I.%I',pol.policyname,pol.schemaname,pol.tablename); end loop;
end $$;

do $$
declare t record;
begin
  for t in select table_schema,table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE' and table_name <> 'spatial_ref_sys'
  loop execute format('revoke all privileges on table %I.%I from anon',t.table_schema,t.table_name); end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['Bomberos','Extintores','Valvulas','ecas','hidrantes','inicio','ipp','leu','pecas','vecas','pulmon_alveolos','territorios_dinamicos','caminos_internos'] loop
    if to_regclass(format('public.%I',t)) is not null then
      execute format('drop policy if exists centinela_role_read on public.%I',t);
      execute format('create policy centinela_role_read on public.%I for select to authenticated using (public.current_user_has_permission(''activos.read'') or public.current_user_has_permission(''personal.read'') or public.current_user_has_permission(''pulmon.read'') or public.current_user_has_permission(''ubicaciones.update''))',t);
    end if;
  end loop;
  foreach t in array array['controles_c','controles_e','controles_ecas','controles_es','controles_h','controles_pc','controles_pecas','controles_pfp','controles_v','controles_vecas'] loop
    if to_regclass(format('public.%I',t)) is not null then
      execute format('drop policy if exists centinela_role_read on public.%I',t);
      execute format('drop policy if exists centinela_role_insert on public.%I',t);
      execute format('drop policy if exists centinela_role_update on public.%I',t);
      execute format('create policy centinela_role_read on public.%I for select to authenticated using (public.current_user_has_permission(''controles.read''))',t);
      execute format('create policy centinela_role_insert on public.%I for insert to authenticated with check (public.current_user_has_permission(''controles.create''))',t);
      execute format('create policy centinela_role_update on public.%I for update to authenticated using (public.current_user_has_permission(''controles.update'')) with check (public.current_user_has_permission(''controles.update''))',t);
    end if;
  end loop;
  if to_regclass('public.anomalias') is not null then
    drop policy if exists centinela_role_read on public.anomalias;
    drop policy if exists centinela_role_insert on public.anomalias;
    drop policy if exists centinela_role_update on public.anomalias;
    create policy centinela_role_read on public.anomalias for select to authenticated using (public.current_user_has_permission('anomalias.read'));
    create policy centinela_role_insert on public.anomalias for insert to authenticated with check (public.current_user_has_permission('anomalias.create'));
    create policy centinela_role_update on public.anomalias for update to authenticated using (public.current_user_has_permission('anomalias.resolve')) with check (public.current_user_has_permission('anomalias.resolve'));
  end if;
  foreach t in array array['movimientos_extintores','movimientos_reemplazos_extintores','reemplazos_temporales_extintores','extintores_trazabilidad'] loop
    if to_regclass(format('public.%I',t)) is not null then
      execute format('drop policy if exists centinela_role_read on public.%I',t);
      execute format('drop policy if exists centinela_role_insert on public.%I',t);
      execute format('drop policy if exists centinela_role_update on public.%I',t);
      execute format('create policy centinela_role_read on public.%I for select to authenticated using (public.current_user_has_permission(''pulmon.read''))',t);
      execute format('create policy centinela_role_insert on public.%I for insert to authenticated with check (public.current_user_has_permission(''pulmon.update''))',t);
      execute format('create policy centinela_role_update on public.%I for update to authenticated using (public.current_user_has_permission(''pulmon.update'')) with check (public.current_user_has_permission(''pulmon.update''))',t);
    end if;
  end loop;
  if to_regclass('public."Bomberos"') is not null then
    drop policy if exists centinela_personal_update on public."Bomberos";
    create policy centinela_personal_update on public."Bomberos" for update to authenticated using (public.current_user_has_permission('personal.manage')) with check (public.current_user_has_permission('personal.manage'));
  end if;
  if to_regclass('public.territorios_dinamicos') is not null then
    drop policy if exists centinela_role_insert on public.territorios_dinamicos;
    drop policy if exists centinela_role_update on public.territorios_dinamicos;
    drop policy if exists centinela_role_delete on public.territorios_dinamicos;
    create policy centinela_role_insert on public.territorios_dinamicos for insert to authenticated with check (public.current_user_has_permission('ubicaciones.update'));
    create policy centinela_role_update on public.territorios_dinamicos for update to authenticated using (public.current_user_has_permission('ubicaciones.update')) with check (public.current_user_has_permission('ubicaciones.update'));
    create policy centinela_role_delete on public.territorios_dinamicos for delete to authenticated using (public.current_user_has_permission('ubicaciones.update'));
  end if;
  if to_regclass('public.caminos_internos') is not null then
    drop policy if exists caminos_internos_admin_manage on public.caminos_internos;
    create policy caminos_internos_admin_manage on public.caminos_internos for all to authenticated using (public.current_user_has_permission('ubicaciones.update')) with check (public.current_user_has_permission('ubicaciones.update'));
  end if;
end $$;
