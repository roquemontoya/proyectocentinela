-- Centinela: activar RLS de tablas operativas con acceso público limitado.
-- Los controles históricos no se pueden borrar desde la API.
do $$
declare t text;
begin
  foreach t in array array['leu','Extintores','hidrantes','ecas','vecas','Valvulas','pecas','Bomberos','inicio'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to anon', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_read', t);
    execute format('create policy %I on public.%I for select to anon using (true)', t || '_anon_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador'')) with check (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador''))', t || '_admin_all', t);
  end loop;

  foreach t in array array['controles_e','controles_h','controles_ecas','controles_vecas','controles_v','controles_pecas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert on table public.%I to anon', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_read', t);
    execute format('create policy %I on public.%I for select to anon using (true)', t || '_anon_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_insert', t);
    execute format('create policy %I on public.%I for insert to anon with check (true)', t || '_anon_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador'')) with check (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador''))', t || '_admin_all', t);
  end loop;

  foreach t in array array['controles_pfp','controles_c','controles_pc','controles_es'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador'')) with check (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador''))', t || '_admin_all', t);
  end loop;

  t := 'anomalias';
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on table public.%I from public, anon, authenticated', t);
  execute format('grant select, insert on table public.%I to anon', t);
  execute format('grant select, insert, update on table public.%I to authenticated', t);
  execute format('drop policy if exists anomalias_anon_read on public.%I', t);
  execute format('create policy anomalias_anon_read on public.%I for select to anon using (true)', t);
  execute format('drop policy if exists anomalias_anon_insert on public.%I', t);
  execute format('create policy anomalias_anon_insert on public.%I for insert to anon with check (true)', t);
  execute format('drop policy if exists anomalias_admin_all on public.%I', t);
  execute format('create policy anomalias_admin_all on public.%I for all to authenticated using (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador'')) with check (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador''))', t);

  t := 'ipp';
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on table public.%I from public, anon, authenticated', t);
  execute format('grant select on table public.%I to anon', t);
  execute format('grant update ("CONTROL MENSUAL (Mes)", "Control Mensual Fecha", "Control M realizado por", "ACCESOS E INTERIOR DEL EDIFICIO", "Pasillos portones obstruidos", "INF VIA SEC", "INF VIA Whatsapp", "Combustible Fachada", "INF_ VIA SEC_", "INF_ VIA Whatsapp_", "Derrames", "INF_ VIA_ SEC_", "INF_ VIA_ Whatsapp_", "CONSIGNAS GENERALES", "Senalizacion Fumadores", "INF_ VIA SEC-", "INF_ VIA Whatsapp-", "Carteleria Fumadores", "INF_ VIA SEC_1", "field_24", "INF_ VIA Whatsapp_1", "field_26", "PROTEC_ CONTRA INCENDIO", "Extintores", "INF_ VIA SEC*", "INF_ VIA Whatsapp*", "Hidrantes", "INF- VIA SEC_", "Ecas") on table public.%I to anon', t);
  execute format('grant select, insert, update on table public.%I to authenticated', t);
  execute format('drop policy if exists ipp_anon_read on public.%I', t);
  execute format('create policy ipp_anon_read on public.%I for select to anon using (true)', t);
  execute format('drop policy if exists ipp_anon_update_controls on public.%I', t);
  execute format('create policy ipp_anon_update_controls on public.%I for update to anon using (true) with check (true)', t);
  execute format('drop policy if exists ipp_admin_all on public.%I', t);
  execute format('create policy ipp_admin_all on public.%I for all to authenticated using (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador'')) with check (public.current_user_has_role(''administrador'') or public.current_user_has_role(''superadministrador''))', t);
end $$;

revoke all on table public.app_roles, public.app_permissions, public.app_role_permissions, public.app_user_roles from public, anon;
revoke truncate on table public.app_roles, public.app_permissions, public.app_role_permissions, public.app_user_roles from authenticated;
grant select, insert, update, delete on table public.app_roles, public.app_permissions, public.app_role_permissions, public.app_user_roles to authenticated;
