create unique index if not exists ux_extintores_alveolo_id_unico
on public."Extintores" (alveolo_id)
where alveolo_id is not null;

create unique index if not exists ux_pulmon_alveolos_extintor_unico
on public.pulmon_alveolos (activo_extintor_id)
where activo_extintor_id is not null;
