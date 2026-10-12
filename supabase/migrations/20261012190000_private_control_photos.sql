-- Centinela: hacer privadas las fotos de controles.
-- Bomberos conservan permiso de subida sin cuentas individuales.
-- Solo administradores autenticados pueden leer las fotos históricas.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'fotos-controles';

DROP POLICY IF EXISTS "Permitir lectura publica fotos-controles" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida publica fotos-controles" ON storage.objects;
DROP POLICY IF EXISTS "centinela_fotos_controles_insert" ON storage.objects;
DROP POLICY IF EXISTS "centinela_fotos_controles_admin_select" ON storage.objects;

CREATE POLICY "centinela_fotos_controles_insert"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'fotos-controles');

CREATE POLICY "centinela_fotos_controles_admin_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'fotos-controles'
    AND (
        public.current_user_has_role('administrador')
        OR public.current_user_has_role('superadministrador')
    )
);

-- Para el popup de control, Bomberos solo puede firmar la última foto por activo.
-- La función no devuelve rutas ni datos; únicamente valida si un objeto es la foto más reciente.
CREATE OR REPLACE FUNCTION public.is_latest_control_photo(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH controls AS (
    SELECT 'hidrantes'::text AS fuente, id_activo::bigint AS id_activo, id::bigint AS id,
           creado_el AS control_ts, foto
    FROM public.controles_h WHERE foto IS NOT NULL
    UNION ALL
    SELECT 'extintores', id_activo::bigint, id::bigint, created_at, foto
    FROM public.controles_e WHERE foto IS NOT NULL
    UNION ALL
    SELECT 'ecas', id_activo::bigint, id::bigint, created_at, foto
    FROM public.controles_ecas WHERE foto IS NOT NULL
    UNION ALL
    SELECT 'pecas', id_activo::bigint, id::bigint, created_at, foto
    FROM public.controles_pecas WHERE foto IS NOT NULL
    UNION ALL
    SELECT 'vecas', id_activo::bigint, id::bigint, created_at, foto
    FROM public.controles_vecas WHERE foto IS NOT NULL
    UNION ALL
    SELECT 'valvulas', id_activo::bigint, id::bigint, created_at, foto
    FROM public.controles_v WHERE foto IS NOT NULL
  ),
  ranked AS (
    SELECT fuente, id_activo, foto,
           row_number() OVER (
             PARTITION BY fuente, id_activo
             ORDER BY control_ts DESC NULLS LAST, id DESC
           ) AS rn
    FROM controls
  ),
  latest_paths AS (
    SELECT CASE
      WHEN foto ~* '^https?://' THEN
        split_part(regexp_replace(foto, '^.*/storage/v1/object/public/fotos-controles/', ''), '?', 1)
      ELSE regexp_replace(foto, '^/?(fotos-controles/)?', '')
    END AS object_path
    FROM ranked
    WHERE rn = 1
  )
  SELECT EXISTS (
    SELECT 1 FROM latest_paths WHERE object_path = p_object_name
  );
$$;

DROP POLICY IF EXISTS "centinela_fotos_controles_latest_select" ON storage.objects;
CREATE POLICY "centinela_fotos_controles_latest_select"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'fotos-controles'
  AND public.is_latest_control_photo(name)
);
