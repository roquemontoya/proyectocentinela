-- Refuerzo: no permitir baja de un extintor si su activo LEU tiene movimientos operativos.
drop policy if exists extintores_pulmon_manage_delete on public."Extintores";
create policy extintores_pulmon_manage_delete on public."Extintores"
for delete to authenticated
using (
 (public.current_user_has_permission('pulmon.manage') or public.current_user_has_permission('pulmon.update'))
 and alveolo_id is null
 and not exists (select 1 from public.reemplazos_temporales_extintores r where r.inventario_reemplazo_id="Extintores".id)
 and not exists (select 1 from public.movimientos_reemplazos_extintores m where m.inventario_reemplazo_id="Extintores".id)
 and not exists (select 1 from public.movimientos_extintores me where me.id_activo="Extintores".activo_leu_id)
);