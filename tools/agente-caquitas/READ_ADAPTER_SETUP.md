# Adaptador de lectura segura — EL_MAYORDOMO_001

## Alcance
- Solo POST; autentica con un token de servicio guardado como secreto.
- Solo acepta la tarea fija `auditoria-extintores` y las identidades declaradas.
- Solo ejecuta tres consultas SELECT con columnas explícitas.
- No contiene rutas de INSERT, UPDATE, DELETE, RPC ni SQL enviado por el cliente.
- Nunca debe conectarse con `service_role` ni con una cuenta PostgreSQL propietaria.

## Secretos requeridos en el entorno de Edge Function
- `AGENTE_CAQ_AUDIT_TOKEN`: token aleatorio largo, exclusivo de este servicio.
- `CENTINELA_READONLY_DB_URL`: conexión PostgreSQL de un usuario con permisos SELECT exclusivamente sobre las tres tablas y columnas utilizadas.

No incluir los valores en GitHub, el frontend, Vercel público, logs o informes.

## Preparación de rol de base de datos
Antes de configurar el secreto, crear/revisar por un administrador de base de datos una identidad PostgreSQL dedicada y verificar:
1. no es owner de tablas ni superuser;
2. no tiene membresía de roles con escritura;
3. tiene CONNECT, USAGE en schema public y SELECT únicamente en:
   - public."Extintores"
   - public.extintores_trazabilidad
   - public.pulmon_alveolos
4. no tiene INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ni permisos por defecto de escritura;
5. una prueba con esa identidad confirma SELECT correcto y que INSERT/UPDATE/DELETE son rechazados.

No ejecutar automáticamente cambios de roles o permisos en producción. La función todavía no se despliega; requiere configurar y probar los secretos en el entorno autorizado primero.
