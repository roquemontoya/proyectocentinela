-- CRUD administrativo seguro para inventario Pulmón y alvéolos.
create or replace function public.crear_alveolo_pulmon(p_codigo text,p_observaciones text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id integer; v_codigo text:=nullif(btrim(p_codigo),'');
begin
 if auth.uid() is null then raise exception 'Se requiere sesión autenticada.'; end if;
 if not (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update')) then raise exception 'No tenés permiso para administrar alvéolos.'; end if;
 if v_codigo is null then raise exception 'El código del alvéolo es obligatorio.'; end if;
 if length(v_codigo)>80 then raise exception 'El código no puede superar 80 caracteres.'; end if;
 perform pg_advisory_xact_lock(71001,1);
 if exists(select 1 from public.pulmon_alveolos where lower(codigo)=lower(v_codigo)) then raise exception 'Ya existe un alvéolo con ese código.'; end if;
 select coalesce(max(id),0)+1 into v_id from public.pulmon_alveolos;
 insert into public.pulmon_alveolos(id,codigo,estado,activo_extintor_id,observaciones) values(v_id,v_codigo,'Libre',null,nullif(btrim(coalesce(p_observaciones,'')),''));
 return jsonb_build_object('ok',true,'id',v_id,'codigo',v_codigo,'estado','Libre');
end $$;
create or replace function public.crear_extintor_stock_pulmon(
 p_activo_leu_id bigint,p_etiqueta text,p_tipo text,p_vencimiento text,p_alveolo_id integer,
 p_numero_serie text default null,p_numero_tarjeta text default null,p_capacidad_kg numeric default null,p_marca text default null,p_ph integer default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_leu public.leu%rowtype; v_alveolo public.pulmon_alveolos%rowtype; v_id integer; v_vencimiento date; v_tipo text;
begin
 if auth.uid() is null then raise exception 'Se requiere sesión autenticada.'; end if;
 if not (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update')) then raise exception 'No tenés permiso para dar de alta extintores en el Pulmón.'; end if;
 if nullif(btrim(p_etiqueta),'') is null then raise exception 'La etiqueta es obligatoria.'; end if;
 if length(p_etiqueta)>180 then raise exception 'La etiqueta no puede superar 180 caracteres.'; end if;
 v_tipo:=private.centinela_tipo_extintor(p_tipo);
 if v_tipo is null then raise exception 'Tipo no válido. Usá PQS, Halón, CO2 o K.'; end if;
 v_vencimiento:=private.centinela_vencimiento_fin_mes(p_vencimiento);
 if v_vencimiento is null or v_vencimiento<=current_date+30 then raise exception 'El vencimiento debe ser válido y tener más de 30 días de vigencia.'; end if;
 select * into v_leu from public.leu where id=p_activo_leu_id and categoria ilike '%extintor%' for update;
 if not found then raise exception 'El ID indicado no corresponde a un extintor existente en LEU.'; end if;
 if exists(select 1 from public."Extintores" where activo_leu_id=p_activo_leu_id) then raise exception 'Ese activo LEU ya tiene un registro en el inventario de extintores.'; end if;
 select * into v_alveolo from public.pulmon_alveolos where id=p_alveolo_id for update;
 if not found or v_alveolo.estado<>'Libre' or v_alveolo.activo_extintor_id is not null then raise exception 'El alvéolo seleccionado no está libre.'; end if;
 perform pg_advisory_xact_lock(71001,2);
 select coalesce(max(id),0)+1 into v_id from public."Extintores";
 insert into public."Extintores"(id,"ETIQUETA","TIPO","Vencimiento","PH","PRP","UBICACION",alveolo_id,numero_serie,numero_tarjeta,capacidad_kg,marca,activo_leu_id)
 values(v_id,btrim(p_etiqueta),v_tipo,btrim(p_vencimiento),p_ph,'En Pulmon',v_alveolo.codigo,v_alveolo.id,nullif(btrim(coalesce(p_numero_serie,'')),''),nullif(btrim(coalesce(p_numero_tarjeta,'')),''),p_capacidad_kg,nullif(btrim(coalesce(p_marca,'')),''),p_activo_leu_id);
 update public.pulmon_alveolos set estado='Ocupado',activo_extintor_id=v_id,actualizado_en=now() where id=v_alveolo.id and estado='Libre' and activo_extintor_id is null;
 if not found then raise exception 'No se pudo ocupar el alvéolo; alta revertida.'; end if;
 return jsonb_build_object('ok',true,'id',v_id,'activo_leu_id',p_activo_leu_id,'alveolo_id',v_alveolo.id,'alveolo_codigo',v_alveolo.codigo);
end $$;
revoke all on function public.crear_alveolo_pulmon(text,text) from public,anon;
revoke all on function public.crear_extintor_stock_pulmon(bigint,text,text,text,integer,text,text,numeric,text,integer) from public,anon;
grant execute on function public.crear_alveolo_pulmon(text,text) to authenticated;
grant execute on function public.crear_extintor_stock_pulmon(bigint,text,text,text,integer,text,text,numeric,text,integer) to authenticated;