-- Privilegios mínimos para que la Edge Function administre cuentas.
grant select, insert, update on table public.app_user_profiles to service_role;
grant select, insert on table public.app_user_audit to service_role;
grant select on table public.app_roles to service_role;
grant select, insert, update, delete on table public.app_user_roles to service_role;
grant select on table public.app_role_permissions to service_role;
grant select on table public.app_permissions to service_role;
