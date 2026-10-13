-- Endurecimiento de seguridad y rendimiento de Recorridos GPS.
create index if not exists caminos_internos_recorrido_origen_idx on public.caminos_internos (recorrido_origen_id);
create index if not exists caminos_internos_creado_por_idx on public.caminos_internos (creado_por);
create index if not exists caminos_internos_validado_por_idx on public.caminos_internos (validado_por);
drop policy if exists caminos_internos_read_validated on public.caminos_internos;
create policy caminos_internos_read_validated on public.caminos_internos
for select to anon, authenticated
using (
  estado = 'validado'
  or ((select auth.uid()) is not null and (
    public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador')
  ))
);

create or replace function public.iniciar_recorrido_gps(
  p_equipo_id text,
  p_equipo_nombre text,
  p_tipo text,
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not (public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador')) then
    raise exception 'Solo administradores pueden operar recorridos GPS.';
  end if;
  if length(btrim(coalesce(p_equipo_id, ''))) not between 2 and 120
     or length(btrim(coalesce(p_equipo_nombre, ''))) not between 2 and 120 then
    raise exception 'Identificador y nombre de equipo son obligatorios (2 a 120 caracteres).';
  end if;
  if p_tipo not in ('ronda', 'relevamiento', 'inspeccion') then
    raise exception 'Tipo de recorrido no válido.';
  end if;
  if length(coalesce(p_token, '')) < 32 or length(p_token) > 200 then
    raise exception 'Token de recorrido no válido.';
  end if;

  insert into public.recorridos_gps (equipo_id, equipo_nombre, tipo, token_hash)
  values (
    btrim(p_equipo_id), btrim(p_equipo_nombre), p_tipo,
    encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'iniciado_en', now());
end;
$$;

create or replace function public.registrar_puntos_recorrido_gps(
  p_recorrido_id uuid,
  p_token text,
  p_puntos jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.recorridos_gps%rowtype;
  v_item jsonb;
  v_insertados integer := 0;
  v_lat double precision;
  v_lng double precision;
  v_seq integer;
  v_capturado timestamptz;
  v_precision double precision;
begin
  if not (public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador')) then
    raise exception 'Solo administradores pueden sincronizar recorridos GPS.';
  end if;
  if jsonb_typeof(p_puntos) <> 'array' or jsonb_array_length(p_puntos) < 1
     or jsonb_array_length(p_puntos) > 500 then
    raise exception 'Enviar entre 1 y 500 puntos por lote.';
  end if;

  select * into v_r from public.recorridos_gps
  where id = p_recorrido_id
    and token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
  for update;
  if not found then raise exception 'Recorrido o token no válido.'; end if;
  if v_r.estado <> 'en_curso' then raise exception 'El recorrido ya está cerrado.'; end if;

  for v_item in select value from jsonb_array_elements(p_puntos) loop
    v_lat := (v_item->>'latitud')::double precision;
    v_lng := (v_item->>'longitud')::double precision;
    v_seq := (v_item->>'secuencia')::integer;
    v_capturado := (v_item->>'capturado_en')::timestamptz;
    v_precision := nullif(v_item->>'precision_m', '')::double precision;
    if v_lat is null or v_lng is null or v_lat not between -90 and 90
       or v_lng not between -180 and 180 or v_seq is null or v_seq < 1
       or v_capturado is null then
      raise exception 'Uno de los puntos contiene coordenadas o fecha inválidas.';
    end if;
    insert into public.puntos_recorrido_gps
      (recorrido_id, secuencia, latitud, longitud, geom, capturado_en, precision_m)
    values
      (p_recorrido_id, v_seq, v_lat, v_lng,
       public.ST_SetSRID(public.ST_MakePoint(v_lng, v_lat), 4326),
       v_capturado, v_precision)
    on conflict (recorrido_id, secuencia) do nothing;
    if found then v_insertados := v_insertados + 1; end if;
  end loop;

  update public.recorridos_gps
  set cantidad_puntos = (
    select count(*)::integer from public.puntos_recorrido_gps where recorrido_id = p_recorrido_id
  )
  where id = p_recorrido_id;
  return v_insertados;
end;
$$;

create or replace function public.finalizar_recorrido_gps(
  p_recorrido_id uuid,
  p_token text,
  p_cancelar boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.recorridos_gps%rowtype;
  v_distancia double precision := 0;
begin
  if not (public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador')) then
    raise exception 'Solo administradores pueden finalizar recorridos GPS.';
  end if;
  select * into v_r from public.recorridos_gps
  where id = p_recorrido_id
    and token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
  for update;
  if not found then raise exception 'Recorrido o token no válido.'; end if;
  if v_r.estado <> 'en_curso' then
    return jsonb_build_object('id', p_recorrido_id, 'estado', v_r.estado, 'distancia_m', v_r.distancia_m);
  end if;

  with ordenados as (
    select geom, lag(geom) over (order by secuencia) anterior
    from public.puntos_recorrido_gps where recorrido_id = p_recorrido_id
  )
  select coalesce(sum(public.ST_Distance(geom::public.geography, anterior::public.geography)), 0)
  into v_distancia from ordenados where anterior is not null;

  update public.recorridos_gps
  set estado = case when p_cancelar then 'cancelado' else 'finalizado' end,
      finalizado_en = now(), distancia_m = v_distancia
  where id = p_recorrido_id;

  return jsonb_build_object(
    'id', p_recorrido_id,
    'estado', case when p_cancelar then 'cancelado' else 'finalizado' end,
    'distancia_m', v_distancia
  );
end;
$$;

create or replace function public.validar_recorrido_como_camino_gps(
  p_recorrido_id uuid,
  p_nombre text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_camino_id uuid;
  v_coords jsonb;
  v_geom public.geometry(LineString, 4326);
begin
  if not (public.current_user_has_role('administrador') or public.current_user_has_role('superadministrador')) then
    raise exception 'Solo administradores pueden validar caminos internos.';
  end if;
  if length(btrim(coalesce(p_nombre, ''))) not between 2 and 160 then
    raise exception 'El nombre del camino debe tener entre 2 y 160 caracteres.';
  end if;
  if not exists (
    select 1 from public.recorridos_gps
    where id = p_recorrido_id and estado = 'finalizado'
  ) then
    raise exception 'Solo se pueden convertir recorridos finalizados en caminos.';
  end if;

  select jsonb_agg(jsonb_build_array(longitud, latitud) order by secuencia),
         public.ST_MakeLine(public.ST_SetSRID(public.ST_MakePoint(longitud, latitud), 4326) order by secuencia)
  into v_coords, v_geom
  from public.puntos_recorrido_gps
  where recorrido_id = p_recorrido_id;
  if v_coords is null or jsonb_array_length(v_coords) < 2 then
    raise exception 'Se necesitan al menos dos puntos para crear un camino.';
  end if;

  insert into public.caminos_internos
    (nombre, recorrido_origen_id, coordenadas, geom, estado, creado_por, validado_por, validado_en)
  values (btrim(p_nombre), p_recorrido_id, v_coords, v_geom, 'validado', auth.uid(), auth.uid(), now())
  returning id into v_camino_id;

  return v_camino_id;
end;
$$;

revoke all on function public.iniciar_recorrido_gps(text, text, text, text) from public, anon;
revoke all on function public.registrar_puntos_recorrido_gps(uuid, text, jsonb) from public, anon;
revoke all on function public.finalizar_recorrido_gps(uuid, text, boolean) from public, anon;
revoke all on function public.validar_recorrido_como_camino_gps(uuid, text) from public, anon;
grant execute on function public.iniciar_recorrido_gps(text, text, text, text) to authenticated;
grant execute on function public.registrar_puntos_recorrido_gps(uuid, text, jsonb) to authenticated;
grant execute on function public.finalizar_recorrido_gps(uuid, text, boolean) to authenticated;
grant execute on function public.validar_recorrido_como_camino_gps(uuid, text) to authenticated;
