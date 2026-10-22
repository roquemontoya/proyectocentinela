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
    v_alveolo public.pulmon_alveolos%rowtype;
    v_prp_nuevo text;
    v_ahora timestamptz := now();
    v_cantidad integer;
begin
    if auth.uid() is null then
        raise exception 'Se requiere una sesión autenticada para registrar la devolución.';
    end if;
    if not (public.current_user_has_permission('pulmon.update') or public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador')) then
        raise exception 'No tenés permiso para registrar devoluciones del Pulmón.';
    end if;
    if nullif(btrim(p_bombero), '') is null then raise exception 'Seleccioná el bombero que devuelve el provisorio.'; end if;
    if p_estado_titular not in ('Reinstalado operativo', 'Retirado para mantenimiento', 'Fuera de servicio') then raise exception 'El estado indicado para el titular no es válido.'; end if;
    if p_estado_reemplazo not in ('Operativo', 'A recarga', 'Fuera de servicio') then raise exception 'El estado indicado para el provisorio no es válido.'; end if;

    select * into v_ciclo from public.reemplazos_temporales_extintores where id = p_ciclo_id and estado = 'Activo' for update;
    if not found then raise exception 'El reemplazo ya no está activo o no existe. Actualizá la vista antes de continuar.'; end if;
    if v_ciclo.inventario_reemplazo_id is null then raise exception 'El ciclo no tiene asociado un extintor del inventario del Pulmón.'; end if;
    select * into v_equipo from public."Extintores" where id = v_ciclo.inventario_reemplazo_id for update;
    if not found then raise exception 'No se encontró el provisorio en el inventario.'; end if;
    if v_equipo."PRP" <> 'Instalado como provisorio' then raise exception 'El provisorio ya no figura instalado. No se modificó ningún registro.'; end if;
    if exists (select 1 from public.reemplazos_temporales_extintores r where r.id <> v_ciclo.id and r.estado = 'Activo' and r.inventario_reemplazo_id = v_ciclo.inventario_reemplazo_id) then raise exception 'El mismo provisorio figura en otro ciclo activo. Revisá el inventario antes de continuar.'; end if;

    v_prp_nuevo := case when p_estado_reemplazo = 'Operativo' then 'En Pulmon' when p_estado_reemplazo = 'A recarga' then 'En Recarga' else 'Fuera de servicio' end;
    if v_prp_nuevo = 'En Pulmon' then
        select * into v_alveolo from public.pulmon_alveolos where estado = 'Libre' and activo_extintor_id is null order by id limit 1 for update skip locked;
        if not found then raise exception 'No hay alvéolos libres. No se registró la devolución.'; end if;
        update public.pulmon_alveolos set estado = 'Ocupado', activo_extintor_id = v_equipo.id, actualizado_en = v_ahora where id = v_alveolo.id and estado = 'Libre' and activo_extintor_id is null;
        get diagnostics v_cantidad = row_count;
        if v_cantidad <> 1 then raise exception 'No se pudo reservar el alvéolo libre; no se registró la devolución.'; end if;
        update public."Extintores" set "PRP" = 'En Pulmon', "UBICACION" = v_alveolo.codigo, alveolo_id = v_alveolo.id where id = v_equipo.id and "PRP" = 'Instalado como provisorio';
        get diagnostics v_cantidad = row_count;
        if v_cantidad <> 1 then raise exception 'El estado del provisorio cambió durante la operación. No se registró la devolución.'; end if;
    else
        update public.pulmon_alveolos set estado = 'Libre', activo_extintor_id = null, actualizado_en = v_ahora where activo_extintor_id = v_equipo.id;
        update public."Extintores" set "PRP" = v_prp_nuevo, "UBICACION" = case when v_prp_nuevo = 'En Recarga' then 'EN RECARGA' else 'FUERA DE SERVICIO' end, alveolo_id = null where id = v_equipo.id and "PRP" = 'Instalado como provisorio';
        get diagnostics v_cantidad = row_count;
        if v_cantidad <> 1 then raise exception 'El estado del provisorio cambió durante la operación. No se registró la devolución.'; end if;
    end if;

    insert into public.movimientos_reemplazos_extintores (reemplazo_id, tipo_movimiento, activo_titular_id, inventario_reemplazo_id, bombero, fecha_hora, estado_titular, estado_reemplazo, observaciones)
    values (v_ciclo.id, 'Devolucion', v_ciclo.activo_titular_id, v_ciclo.inventario_reemplazo_id, btrim(p_bombero), v_ahora, p_estado_titular, p_estado_reemplazo, nullif(btrim(coalesce(p_observaciones, '')), ''));
    update public.reemplazos_temporales_extintores set estado = 'Finalizado', fecha_fin = v_ahora::date, fecha_hora_fin = v_ahora, responsable_fin = btrim(p_bombero), bombero_devuelve_reemplazo_id = btrim(p_bombero), actualizado_en = v_ahora, observaciones = nullif(concat_ws(' | ', nullif(btrim(coalesce(v_ciclo.observaciones, '')), ''), nullif(btrim(coalesce(p_observaciones, '')), '')), '') where id = v_ciclo.id and estado = 'Activo';
    get diagnostics v_cantidad = row_count;
    if v_cantidad <> 1 then raise exception 'No se pudo cerrar el ciclo de reemplazo; la operación se revirtió.'; end if;
    return jsonb_build_object('ok', true, 'ciclo_id', v_ciclo.id, 'extintor_id', v_equipo.id, 'estado', v_prp_nuevo, 'alveolo_id', case when v_prp_nuevo = 'En Pulmon' then v_alveolo.id else null end, 'alveolo_codigo', case when v_prp_nuevo = 'En Pulmon' then v_alveolo.codigo else null end);
end;
$$;
revoke all on function public.registrar_devolucion_reemplazo_pulmon(bigint, text, text, text, text) from public, anon;
grant execute on function public.registrar_devolucion_reemplazo_pulmon(bigint, text, text, text, text) to authenticated;
