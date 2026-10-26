-- Reordenamiento de jerarquía administrativa solicitado.
-- Gerente > Jefe de Seguridad Patrimonial > tres jefaturas en la misma escala.
update public.app_roles
set nombre = 'Gerente',
    descripcion = 'Gerencia: solo lectura de información operativa, exportaciones y estadísticas'
where role_key = 'gerencia';

update public.app_roles
set nombre = 'Jefe de Protección de Planta (Guardia Física)',
    descripcion = 'Jefatura al mismo nivel que Prevención de Incendios y RHP; solo lectura'
where role_key = 'jefe_guardia_fisica';

update public.app_roles
set nombre = 'Jefe de Prevención de Incendios',
    descripcion = 'Jefatura al mismo nivel que Protección de Planta y RHP; solo lectura'
where role_key = 'jefe_prevencion_incendios';

update public.app_roles
set nombre = 'Jefe de RHP (Recursos Altamente Protegidos)',
    descripcion = 'Jefatura al mismo nivel que Protección de Planta y Prevención de Incendios; solo lectura'
where role_key = 'jefe_rhp';

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
  where ur.user_id=new.id
  order by case r.role_key
    when 'superadministrador' then 1
    when 'administrador' then 2
    when 'mantenimiento' then 3
    when 'gerencia' then 4
    when 'jefe_seguridad_patrimonial' then 5
    when 'jefe_guardia_fisica' then 6
    when 'jefe_prevencion_incendios' then 6
    when 'jefe_rhp' then 6
    when 'supervisor' then 7
    when 'bombero_referente' then 8
    when 'bombero_inspector' then 9
    else 99 end
  limit 1;

  case v_role
    when 'superadministrador' then v_inicio:=0; v_fin:=9;
    when 'administrador' then v_inicio:=10; v_fin:=29;
    when 'mantenimiento' then v_inicio:=30; v_fin:=49;
    when 'gerencia' then v_inicio:=130; v_fin:=149;
    when 'jefe_seguridad_patrimonial' then v_inicio:=50; v_fin:=69;
    when 'jefe_guardia_fisica' then v_inicio:=70; v_fin:=89;
    when 'jefe_prevencion_incendios' then v_inicio:=90; v_fin:=109;
    when 'jefe_rhp' then v_inicio:=110; v_fin:=129;
    when 'supervisor' then v_inicio:=150; v_fin:=179;
    when 'bombero_referente' then v_inicio:=180; v_fin:=229;
    when 'bombero_inspector' then v_inicio:=230; v_fin:=1999;
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
