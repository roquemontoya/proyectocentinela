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
