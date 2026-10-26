create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.asignar_legajo_primer_ingreso()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_nombre text;
  v_legajo text;
  v_next bigint;
begin
  if new.last_sign_in_at is null or old.last_sign_in_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('centinela_legajo_sequence'));

  v_nombre := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nombre_completo', '')), '');
  if v_nombre is null then
    v_nombre := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuario Centinela');
  end if;

  insert into public.app_user_profiles (user_id, nombre_completo, legajo, activo)
  values (new.id, v_nombre, null, true)
  on conflict (user_id) do nothing;

  select legajo into v_legajo
  from public.app_user_profiles
  where user_id = new.id
  for update;

  if v_legajo is null or trim(v_legajo) = '' then
    select coalesce(max(case when legajo ~ '^[0-9]+$' then legajo::bigint end), 0) + 1
      into v_next
    from public.app_user_profiles;

    loop
      v_legajo := v_next::text;
      exit when not exists (
        select 1 from public.app_user_profiles p where p.legajo = v_legajo and p.user_id <> new.id
      );
      v_next := v_next + 1;
    end loop;

    update public.app_user_profiles
      set legajo = v_legajo, nombre_completo = v_nombre, updated_at = now()
      where user_id = new.id and (legajo is null or trim(legajo) = '');
  end if;

  return new;
end;
$$;

revoke all on function private.asignar_legajo_primer_ingreso() from public, anon, authenticated;

drop trigger if exists centinela_asignar_legajo_primer_ingreso on auth.users;
create trigger centinela_asignar_legajo_primer_ingreso
after update of last_sign_in_at on auth.users
for each row
when (old.last_sign_in_at is null and new.last_sign_in_at is not null)
execute function private.asignar_legajo_primer_ingreso();
