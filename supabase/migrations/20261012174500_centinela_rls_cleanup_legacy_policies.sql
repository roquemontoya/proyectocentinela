-- Eliminar políticas duplicadas que quedaron de la etapa previa a RLS.
drop policy if exists "Permitir insert anonimo en controles_e" on public.controles_e;
drop policy if exists "Permitir insert anonimo en controles_h" on public.controles_h;
