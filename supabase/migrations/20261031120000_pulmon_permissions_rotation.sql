-- Centinela: permisos granulares del Pulmón y rotación operativa por Bombero Inspector.
-- La rotación se realiza exclusivamente mediante RPC transaccionales; no se conceden
-- INSERT/UPDATE directos sobre ciclos o movimientos al rol Inspector.

create or replace function private.centinela_tipo_extintor(p_tipo text)
returns text
language sql immutable
set search_path = pg_catalog
as $$
  select case
    when regexp_replace(translate(upper(coalesce(p_tipo,'')), 'ÁÉÍÓÚÜ', 'AEIOUU'), '[^A-Z0-9]+', '', 'g') in ('PQS','POLVOQUIMICOSECO')
      or regexp_replace(translate(upper(coalesce(p_tipo,'')), 'ÁÉÍÓÚÜ', 'AEIOUU'), '[^A-Z0-9]+', '', 'g') like '%PQS%' then 'PQS'
    when regexp_replace(translate(upper(coalesce(p_tipo,'')), 'ÁÉÍÓÚÜ', 'AEIOUU'), '[^A-Z0-9]+', '', 'g') like '%HALON%' then 'HALON'
    when regexp_replace(translate(upper(coalesce(p_tipo,'')), 'ÁÉÍÓÚÜ', 'AEIOUU'), '[^A-Z0-9]+', '', 'g') like '%CO2%' then 'CO2'
    when regexp_replace(translate(upper(coalesce(p_tipo,'')), 'ÁÉÍÓÚÜ', 'AEIOUU'), '[^A-Z0-9]+', '', 'g') in ('K','CLASEK') then 'K'
    else null
  end;
$$;

create or replace function private.centinela_vencimiento_fin_mes(p_valor text)
returns date
language plpgsql immutable
set search_path = pg_catalog
as $$
declare
  v text := btrim(coalesce(p_valor,''));
  m text[];
  anio integer;
  mes integer;
begin
  if v = '' then return null; end if;
  m := regexp_match(v, '^([0-9]{1,2})[/-]([0-9]{2}|[0-9]{4})$');
  if m is not null then
    mes := m[1]::integer;
    anio := m[2]::integer;
    if anio < 100 then anio := 2000 + anio; end if;
    if mes < 1 or mes > 12 or anio < 2000 or anio > 2200 then return null; end if;
    return (make_date(anio, mes, 1) + interval '1 month - 1 day')::date;
  end if;
  m := regexp_match(v, '^([0-9]{4})-([0-9]{1,2})(?:-([0-9]{1,2}))?$');
  if m is not null then
    anio := m[1]::integer;
    mes := m[2]::integer;
    if mes < 1 or mes > 12 or anio < 2000 or anio > 2200 then return null; end if;
    if m[3] is not null then
      return make_date(anio, mes, m[3]::integer);
    end if;
    return (make_date(anio, mes, 1) + interval '1 month - 1 day')::date;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function private.centinela_tipo_extintor(text) from public, anon, authenticated;
revoke all on function private.centinela_vencimiento_fin_mes(text) from public, anon, authenticated;

insert into public.app_permissions(permission_key, descripcion) values
 ('pulmon.rotate','Rotar extintores entre Pulmón y Producción mediante movimientos transaccionales'),
 ('pulmon.manage','Administrar inventario de extintores y alvéolos del Pulmón')
on conflict(permission_key) do update set descripcion=excluded.descripcion;

-- Bombero Inspector: únicamente rotación.
insert into public.app_role_permissions(role_id,permission_id)
select r.id,p.id
from public.app_roles r
join public.app_permissions p on p.permission_key='pulmon.rotate'
where r.role_key='bombero_inspector'
on conflict do nothing;

-- Bombero Referente y todos los niveles superiores de la jerarquía operativa.
-- Mantenimiento conserva su permiso técnico pulmon.update independiente.
insert into public.app_role_permissions(role_id,permission_id)
select r.id,p.id
from public.app_roles r
cross join public.app_permissions p
where r.role_key in (
 'bombero_referente','supervisor','jefe_seguridad_patrimonial',
 'jefe_guardia_fisica','jefe_prevencion_incendios','jefe_rhp',
 'gerencia','administrador','superadministrador'
)
and p.permission_key in ('pulmon.rotate','pulmon.manage')
on conflict do nothing;

-- CRUD del inventario: solo gestores Pulmón (o el permiso técnico heredado).
grant insert, update, delete on public."Extintores" to authenticated;
drop policy if exists Extintores_pulmon_manage_insert on public."Extintores";
create policy Extintores_pulmon_manage_insert on public."Extintores"
for insert to authenticated
with check (
  public.current_user_has_permission('pulmon.manage')
  or public.current_user_has_permission('pulmon.update')
);
drop policy if exists Extintores_pulmon_manage_update on public."Extintores";
create policy Extintores_pulmon_manage_update on public."Extintores"
for update to authenticated
using (
  public.current_user_has_permission('pulmon.manage')
  or public.current_user_has_permission('pulmon.update')
)
with check (
  public.current_user_has_permission('pulmon.manage')
  or public.current_user_has_permission('pulmon.update')
);
drop policy if exists Extintores_pulmon_manage_delete on public."Extintores";
create policy Extintores_pulmon_manage_delete on public."Extintores"
for delete to authenticated
using (
  (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update'))
  and alveolo_id is null
  and not exists (
    select 1 from public.reemplazos_temporales_extintores r
    where r.inventario_reemplazo_id = "Extintores".id and r.estado = 'Activo'
  )
  and not exists (
    select 1 from public.movimientos_reemplazos_extintores m
    where m.inventario_reemplazo_id = "Extintores".id
  )
);

-- CRUD de alvéolos: la eliminación solo se permite cuando el alvéolo está vacío.
grant insert, update, delete on public.pulmon_alveolos to authenticated;
drop policy if exists pulmon_alveolos_pulmon_manage_insert on public.pulmon_alveolos;
create policy pulmon_alveolos_pulmon_manage_insert on public.pulmon_alveolos
for insert to authenticated
with check (
  (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update'))
  and estado = 'Libre' and activo_extintor_id is null
);
drop policy if exists pulmon_alveolos_pulmon_manage_update on public.pulmon_alveolos;
create policy pulmon_alveolos_pulmon_manage_update on public.pulmon_alveolos
for update to authenticated
using (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update'))
with check (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update'));
drop policy if exists pulmon_alveolos_pulmon_manage_delete on public.pulmon_alveolos;
create policy pulmon_alveolos_pulmon_manage_delete on public.pulmon_alveolos
for delete to authenticated
using (
  (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update'))
  and estado = 'Libre' and activo_extintor_id is null
);

-- Reemplazo temporal: Inspector solo usa los RPC; no obtiene INSERT/UPDATE directos.
-- Los gestores y el rol técnico mantienen las rutas de administración que ya existían.

create or replace function public.registrar_instalacion_reemplazo_pulmon(
  p_activo_titular_id bigint,
  p_inventario_reemplazo_id bigint,
  p_bombero text,
  p_motivo text,
  p_tipo_titular text,
  p_tipo_reemplazo text,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_titular public.leu%rowtype;
  v_reemplazo public."Extintores"%rowtype;
  v_alveolo public.pulmon_alveolos%rowtype;
  v_ciclo_id bigint;
  v_now timestamptz := now();
  v_count integer;
  v_origen text;
  v_bombero text;
  v_tipo_titular text;
  v_tipo_reemplazo text;
  v_vencimiento date;
begin
  if auth.uid() is null then raise exception 'Se requiere sesión autenticada.'; end if;
  if not (
    public.current_user_has_permission('pulmon.rotate')
    or public.current_user_has_permission('pulmon.manage')
    or public.current_user_has_permission('pulmon.update')
    or public.current_user_has_role('administrador')
    or public.current_user_has_role('superadministrador')
  ) then raise exception 'No tenés permiso para rotar extintores entre Pulmón y Producción.'; end if;

  select nullif(btrim(nombre_completo),'') into v_bombero
  from public.app_user_profiles
  where user_id=auth.uid() and activo is true;
  if v_bombero is null then raise exception 'No se pudo identificar al usuario autenticado en el perfil activo.'; end if;
  if nullif(btrim(p_bombero),'') is not null and lower(btrim(p_bombero)) <> lower(v_bombero) then
    raise exception 'El responsable indicado no coincide con el usuario autenticado (%).', v_bombero;
  end if;
  if nullif(btrim(p_motivo),'') is null then raise exception 'Indicá el motivo de la rotación.'; end if;

  select * into v_titular
  from public.leu
  where id=p_activo_titular_id and categoria ilike '%extintor%'
  for update;
  if not found then raise exception 'No existe el activo titular o no es un extintor en LEU.'; end if;

  select * into v_reemplazo
  from public."Extintores"
  where id=p_inventario_reemplazo_id
  for update;
  if not found then raise exception 'No existe el extintor seleccionado del Pulmón.'; end if;
  if v_reemplazo.activo_leu_id is null then raise exception 'El extintor del Pulmón no está vinculado a un activo maestro.'; end if;
  if v_reemplazo."PRP" not in ('En Pulmon','En Pulmón') then raise exception 'El extintor ya no está disponible en el Pulmón.'; end if;
  if v_reemplazo.alveolo_id is null then raise exception 'El extintor no tiene alvéolo de origen; revisá el inventario.'; end if;

  v_tipo_titular := private.centinela_tipo_extintor(
    coalesce(
      v_titular.atributos_tecnicos->'atributos_originales'->>'Tipo de Extintor',
      v_titular.atributos_tecnicos->>'tipo_extintor',
      v_titular.atributos_tecnicos->>'tipo'
    )
  );
  v_tipo_reemplazo := private.centinela_tipo_extintor(v_reemplazo."TIPO");
  if v_tipo_titular is null or v_tipo_reemplazo is null then
    raise exception 'No se pudo identificar el tipo del titular o del reemplazo. No se realizó ningún movimiento.';
  end if;
  if not (
    (v_tipo_titular='PQS' and v_tipo_reemplazo in ('PQS','HALON','CO2'))
    or (v_tipo_titular='HALON' and v_tipo_reemplazo='HALON')
    or (v_tipo_titular='CO2' and v_tipo_reemplazo in ('CO2','HALON'))
    or (v_tipo_titular='K' and v_tipo_reemplazo='K')
  ) then
    raise exception 'Reemplazo incompatible: titular % / equipo Pulmón %.', v_tipo_titular, v_tipo_reemplazo;
  end if;

  v_vencimiento := private.centinela_vencimiento_fin_mes(v_reemplazo."Vencimiento");
  if v_vencimiento is null or v_vencimiento <= current_date + 30 then
    raise exception 'El extintor del Pulmón debe tener vencimiento verificable y más de 30 días de vigencia.';
  end if;

  select * into v_alveolo from public.pulmon_alveolos
  where id=v_reemplazo.alveolo_id
  for update;
  if not found or v_alveolo.estado <> 'Ocupado' or v_alveolo.activo_extintor_id <> v_reemplazo.id then
    raise exception 'El alvéolo y el extintor no coinciden; movimiento cancelado.';
  end if;
  if exists (
    select 1 from public.reemplazos_temporales_extintores
    where estado='Activo'
      and (activo_titular_id=p_activo_titular_id or inventario_reemplazo_id=p_inventario_reemplazo_id)
  ) then raise exception 'El titular o el reemplazo ya participa en un ciclo activo.'; end if;

  v_origen := coalesce(nullif(btrim(v_reemplazo."UBICACION"),''),v_alveolo.codigo);
  insert into public.reemplazos_temporales_extintores (
    activo_titular_id, activo_reemplazo_id, inventario_reemplazo_id, tipo_titular, tipo_reemplazo,
    fecha_inicio, fecha_hora_inicio, motivo, responsable_inicio, bombero_entrega_reemplazo_id,
    estado, observaciones, creado_por, creado_en, actualizado_en
  ) values (
    p_activo_titular_id, v_reemplazo.activo_leu_id, p_inventario_reemplazo_id,
    coalesce(nullif(btrim(p_tipo_titular),''),'Extintor titular'),
    coalesce(nullif(btrim(p_tipo_reemplazo),''),'Extintor Pulmón'),
    v_now::date, v_now, btrim(p_motivo), v_bombero, v_bombero,
    'Activo', nullif(btrim(coalesce(p_observaciones,'')),''), auth.uid()::text, v_now, v_now
  ) returning id into v_ciclo_id;

  update public.pulmon_alveolos
  set estado='Libre', activo_extintor_id=null, actualizado_en=v_now
  where id=v_alveolo.id and estado='Ocupado' and activo_extintor_id=v_reemplazo.id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'No se pudo liberar el alvéolo; movimiento revertido.'; end if;

  update public."Extintores"
  set "PRP"='Instalado como provisorio',
      "UBICACION"=coalesce(nullif(btrim(v_titular.etiqueta),''),'LEU '||v_titular.id::text),
      alveolo_id=null
  where id=v_reemplazo.id and "PRP" in ('En Pulmon','En Pulmón');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'El estado del provisorio cambió; movimiento revertido.'; end if;

  update public.leu
  set atributos_tecnicos = coalesce(atributos_tecnicos,'{}'::jsonb) || jsonb_build_object(
    'estado_ubicacion','Cubierto por reemplazo temporal',
    'reemplazo_temporal_id',v_ciclo_id,
    'extintor_provisorio_leu_id',v_reemplazo.activo_leu_id,
    'ubicacion_operativa',v_titular.etiqueta,
    'fecha_inicio_reemplazo',v_now,
    'responsable_reemplazo',v_bombero
  )
  where id=p_activo_titular_id;

  insert into public.movimientos_extintores(
    id_activo,fecha_movimiento,tipo_movimiento,ubicacion_origen,ubicacion_destino,
    estado_ubicacion_resultante,responsable,referencia_documental,observaciones
  ) values
  (v_reemplazo.activo_leu_id,v_now,'asignacion_uso',v_origen,v_titular.etiqueta,'confirmada',v_bombero,
   'reemplazo_temporal:'||v_ciclo_id,'Salida del Pulmón; alvéolo liberado '||v_alveolo.codigo||
   coalesce(' | '||nullif(btrim(p_observaciones),''),'')),
  (p_activo_titular_id,v_now,'traslado',v_titular.sector,v_titular.etiqueta,'confirmada',v_bombero,
   'reemplazo_temporal:'||v_ciclo_id,'Titular cubierto temporalmente por extintor LEU '||v_reemplazo.activo_leu_id);

  insert into public.movimientos_reemplazos_extintores(
    reemplazo_id,tipo_movimiento,activo_titular_id,inventario_reemplazo_id,bombero,fecha_hora,
    estado_titular,estado_reemplazo,observaciones
  ) values (
    v_ciclo_id,'Instalacion',p_activo_titular_id,p_inventario_reemplazo_id,v_bombero,v_now,
    'Cubierto por reemplazo temporal','Instalado como provisorio',
    nullif(btrim(coalesce(p_observaciones,'')),'')
  );

  return jsonb_build_object(
    'ok',true,'ciclo_id',v_ciclo_id,'activo_titular_id',p_activo_titular_id,
    'activo_reemplazo_leu_id',v_reemplazo.activo_leu_id,'inventario_reemplazo_id',p_inventario_reemplazo_id,
    'alveolo_liberado',v_alveolo.codigo,'estado','Activo','responsable',v_bombero
  );
end;
$$;

create or replace function public.registrar_devolucion_reemplazo_pulmon(
  p_ciclo_id bigint,
  p_bombero text,
  p_estado_titular text,
  p_estado_reemplazo text,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ciclo public.reemplazos_temporales_extintores%rowtype;
  v_equipo public."Extintores"%rowtype;
  v_titular public.leu%rowtype;
  v_alveolo public.pulmon_alveolos%rowtype;
  v_prp_nuevo text;
  v_now timestamptz := now();
  v_count integer;
  v_bombero text;
  v_es_gestor boolean;
begin
  if auth.uid() is null then raise exception 'Se requiere sesión autenticada.'; end if;
  v_es_gestor := (
    public.current_user_has_permission('pulmon.manage')
    or public.current_user_has_permission('pulmon.update')
    or public.current_user_has_role('administrador')
    or public.current_user_has_role('superadministrador')
  );
  if not (
    public.current_user_has_permission('pulmon.rotate')
    or v_es_gestor
  ) then raise exception 'No tenés permiso para registrar devoluciones del Pulmón.'; end if;

  select nullif(btrim(nombre_completo),'') into v_bombero
  from public.app_user_profiles
  where user_id=auth.uid() and activo is true;
  if v_bombero is null then raise exception 'No se pudo identificar al usuario autenticado en el perfil activo.'; end if;
  if nullif(btrim(p_bombero),'') is not null and lower(btrim(p_bombero)) <> lower(v_bombero) then
    raise exception 'El responsable indicado no coincide con el usuario autenticado (%).', v_bombero;
  end if;

  if p_estado_titular not in ('Reinstalado operativo','Retirado para mantenimiento','Fuera de servicio') then
    raise exception 'Estado de titular no válido.';
  end if;
  if p_estado_reemplazo not in ('Operativo','A recarga','Fuera de servicio') then
    raise exception 'Estado de reemplazo no válido.';
  end if;
  if not v_es_gestor and (p_estado_reemplazo <> 'Operativo') then
    raise exception 'El Bombero Inspector solo puede devolver el reemplazo al stock operativo del Pulmón.';
  end if;

  select * into v_ciclo
  from public.reemplazos_temporales_extintores
  where id=p_ciclo_id and estado='Activo'
  for update;
  if not found then raise exception 'El ciclo ya no está activo o no existe.'; end if;
  if v_ciclo.inventario_reemplazo_id is null then raise exception 'El ciclo no tiene inventario de reemplazo asociado.'; end if;

  select * into v_titular from public.leu where id=v_ciclo.activo_titular_id for update;
  if not found then raise exception 'No se encuentra el activo titular en LEU.'; end if;
  select * into v_equipo from public."Extintores" where id=v_ciclo.inventario_reemplazo_id for update;
  if not found or v_equipo."PRP" <> 'Instalado como provisorio' then
    raise exception 'El provisorio no figura instalado; no se modificó ningún registro.';
  end if;
  if exists (
    select 1 from public.reemplazos_temporales_extintores r
    where r.id<>v_ciclo.id and r.estado='Activo' and r.inventario_reemplazo_id=v_equipo.id
  ) then raise exception 'El provisorio figura en otro ciclo activo.'; end if;

  v_prp_nuevo := case when p_estado_reemplazo='Operativo' then 'En Pulmon'
                      when p_estado_reemplazo='A recarga' then 'En Recarga'
                      else 'Fuera de servicio' end;
  if v_prp_nuevo='En Pulmon' then
    select * into v_alveolo
    from public.pulmon_alveolos
    where estado='Libre' and activo_extintor_id is null
    order by id limit 1 for update skip locked;
    if not found then raise exception 'No hay alvéolos libres; devolución revertida.'; end if;
    update public.pulmon_alveolos
    set estado='Ocupado',activo_extintor_id=v_equipo.id,actualizado_en=v_now
    where id=v_alveolo.id and estado='Libre' and activo_extintor_id is null;
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'No se pudo reservar alvéolo; devolución revertida.'; end if;
    update public."Extintores"
    set "PRP"='En Pulmon',"UBICACION"=v_alveolo.codigo,alveolo_id=v_alveolo.id
    where id=v_equipo.id and "PRP"='Instalado como provisorio';
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'No se pudo actualizar el provisorio; devolución revertida.'; end if;
  else
    update public.pulmon_alveolos
    set estado='Libre',activo_extintor_id=null,actualizado_en=v_now
    where activo_extintor_id=v_equipo.id;
    update public."Extintores"
    set "PRP"=v_prp_nuevo,
        "UBICACION"=case when v_prp_nuevo='En Recarga' then 'EN RECARGA' else 'FUERA DE SERVICIO' end,
        alveolo_id=null
    where id=v_equipo.id and "PRP"='Instalado como provisorio';
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'No se pudo actualizar el provisorio; devolución revertida.'; end if;
  end if;

  update public.leu
  set atributos_tecnicos =
    (coalesce(atributos_tecnicos,'{}'::jsonb) - 'reemplazo_temporal_id' - 'extintor_provisorio_leu_id' - 'fecha_inicio_reemplazo' - 'responsable_reemplazo')
    || jsonb_build_object(
      'estado_ubicacion',p_estado_titular,
      'ultima_devolucion_reemplazo',v_now,
      'ultima_devolucion_responsable',v_bombero
    )
  where id=v_titular.id;

  insert into public.movimientos_extintores(
    id_activo,fecha_movimiento,tipo_movimiento,ubicacion_origen,ubicacion_destino,
    estado_ubicacion_resultante,responsable,referencia_documental,observaciones
  ) values
  (v_equipo.activo_leu_id,v_now,'retorno_recarga',coalesce(v_equipo."UBICACION",'Ubicación temporal'),
   case when v_prp_nuevo='En Pulmon' then v_alveolo.codigo else v_prp_nuevo end,
   'confirmada',v_bombero,'reemplazo_temporal:'||v_ciclo.id,
   'Retorno del provisorio; resultado: '||v_prp_nuevo||coalesce(' | '||nullif(btrim(p_observaciones),''),'')),
  (v_titular.id,v_now,'retorno_recarga',v_titular.etiqueta,
   case when p_estado_titular='Reinstalado operativo' then v_titular.etiqueta else p_estado_titular end,
   'confirmada',v_bombero,'reemplazo_temporal:'||v_ciclo.id,
   'Cierre del reemplazo temporal.'||coalesce(' | '||nullif(btrim(p_observaciones),''),''));

  insert into public.movimientos_reemplazos_extintores(
    reemplazo_id,tipo_movimiento,activo_titular_id,inventario_reemplazo_id,bombero,fecha_hora,
    estado_titular,estado_reemplazo,observaciones
  ) values (
    v_ciclo.id,'Devolucion',v_ciclo.activo_titular_id,v_ciclo.inventario_reemplazo_id,
    v_bombero,v_now,p_estado_titular,p_estado_reemplazo,
    nullif(btrim(coalesce(p_observaciones,'')),'')
  );

  update public.reemplazos_temporales_extintores
  set estado='Finalizado',fecha_fin=v_now::date,fecha_hora_fin=v_now,
      responsable_fin=v_bombero,bombero_devuelve_reemplazo_id=v_bombero,
      actualizado_en=v_now,
      observaciones=nullif(concat_ws(' | ',nullif(btrim(coalesce(observaciones,'')),''),nullif(btrim(coalesce(p_observaciones,'')),'')),'')
  where id=v_ciclo.id and estado='Activo';
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'No se pudo cerrar el ciclo; devolución revertida.'; end if;

  return jsonb_build_object(
    'ok',true,'ciclo_id',v_ciclo.id,'extintor_id',v_equipo.id,'estado',v_prp_nuevo,
    'alveolo_id',case when v_prp_nuevo='En Pulmon' then v_alveolo.id else null end,
    'alveolo_codigo',case when v_prp_nuevo='En Pulmon' then v_alveolo.codigo else null end,
    'responsable',v_bombero
  );
end;
$$;

-- El rol gestor también puede operar el circuito de recarga; Inspector no recibe pulmon.update.
do $$
declare
  v_def text;
  v_old text := 'IF NOT (public.current_user_has_permission(''pulmon.update'') OR public.current_user_has_role(''administrador'') OR public.current_user_has_role(''superadministrador'')) THEN RAISE EXCEPTION ''Sin permiso para mover inventario del Pulmón.''; END IF;';
  v_new text := 'IF NOT (public.current_user_has_permission(''pulmon.manage'') OR public.current_user_has_permission(''pulmon.update'') OR public.current_user_has_role(''administrador'') OR public.current_user_has_role(''superadministrador'')) THEN RAISE EXCEPTION ''Sin permiso para mover inventario del Pulmón.''; END IF;';
begin
  v_def := pg_get_functiondef('public.registrar_movimiento_stock_pulmon(bigint,text,text,text)'::regprocedure);
  if position(v_old in v_def) = 0 then
    raise exception 'No se encontró el control de permisos esperado en registrar_movimiento_stock_pulmon; migración cancelada.';
  end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $$;

revoke all on function public.registrar_instalacion_reemplazo_pulmon(bigint,bigint,text,text,text,text,text) from public, anon;
revoke all on function public.registrar_devolucion_reemplazo_pulmon(bigint,text,text,text,text) from public, anon;
grant execute on function public.registrar_instalacion_reemplazo_pulmon(bigint,bigint,text,text,text,text,text) to authenticated;
grant execute on function public.registrar_devolucion_reemplazo_pulmon(bigint,text,text,text,text) to authenticated;

-- Limpieza acotada de la prueba ficticia autorizada por el usuario.
-- Solo borra el control 1430 y la anomalía 78 si coinciden todos los datos identificadores.
delete from public.anomalias
where id=78
  and id_activo=2232
  and reportado_fecha=date '2026-10-31'
  and reportado_por='Controlin'
  and anomalia_detectada='Extintor vencido';

delete from public.controles_e
where id=1430
  and id_activo=2232
  and controlrealizadopor='Controlin'
  and nombreetiqueta='Extintor 458 PQS 5KG DEPÓSITO E8 PARED SUR'
  and foto='1793434759348_pju1gxy7.png';
