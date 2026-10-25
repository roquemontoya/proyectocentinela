-- Rol de consulta Bombero Referente. No otorga permisos de escritura ni altera roles existentes.
INSERT INTO public.app_roles (role_key, nombre, descripcion)
VALUES (
  'bombero_referente',
  'Bombero Referente',
  'Consulta controles, personal de Bomberos, anomalías e inventario de extintores en planta, Pulmón y proveedor. Solo lectura.'
)
ON CONFLICT (role_key) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;
