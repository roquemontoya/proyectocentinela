create or replace function public.registrar_instalacion_reemplazo_pulmon(
  p_activo_titular_id bigint,
  p_inventario_reemplazo_id bigint,
  p_bombero text,
  p_motivo text default null,
  p_tipo_titular text default 'Extintor titular',
  p_tipo_reemplazo text default 'Extintor Pulmón',
  p_observaciones text default null,
  p_control_inicio_id bigint default null
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
    activo_titular_id, activo_reemplazo_id, inventario_reemplazo_id, control_inicio_id, tipo_titular, tipo_reemplazo,
    fecha_inicio, fecha_hora_inicio, motivo, responsable_inicio, bombero_entrega_reemplazo_id,
    estado, observaciones, creado_por, creado_en, actualizado_en
  ) values (
    p_activo_titular_id, v_reemplazo.activo_leu_id, p_inventario_reemplazo_id, p_control_inicio_id,
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

revoke all on function public.registrar_instalacion_reemplazo_pulmon(bigint,bigint,text,text,text,text,text,bigint) from public, anon;
grant execute on function public.registrar_instalacion_reemplazo_pulmon(bigint,bigint,text,text,text,text,text,bigint) to authenticated;
