-- Centinela: atomic control + anomaly writes and resolution tracking.
ALTER TABLE public.anomalias
  ADD COLUMN IF NOT EXISTS tabla_control text,
  ADD COLUMN IF NOT EXISTS id_control bigint,
  ADD COLUMN IF NOT EXISTS fecha_resolucion date,
  ADD COLUMN IF NOT EXISTS detalle_resolucion text,
  ADD COLUMN IF NOT EXISTS resuelto_por text;

CREATE UNIQUE INDEX IF NOT EXISTS anomalias_control_origen_unico
  ON public.anomalias (tabla_control, id_control)
  WHERE tabla_control IS NOT NULL AND id_control IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guardar_control_con_anomalia(
  p_tabla_control text,
  p_control jsonb,
  p_anomalia jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id_control bigint;
  v_id_anomalia bigint;
  v_anomalia jsonb;
  v_columnas text;
  v_expresiones text;
BEGIN
  IF p_tabla_control IS NULL OR p_tabla_control NOT IN (
    'controles_e', 'controles_h', 'controles_ecas',
    'controles_pecas', 'controles_vecas', 'controles_v',
    'controles_pc'
  ) THEN
    RAISE EXCEPTION 'Tabla de controles no autorizada';
  END IF;
  IF p_control IS NULL OR jsonb_typeof(p_control) <> 'object' THEN
    RAISE EXCEPTION 'El control debe ser un objeto JSON';
  END IF;

  SELECT string_agg(format('%I', c.column_name), ', '),
         string_agg(format('(jsonb_populate_record(NULL::public.%I, $1)).%I', p_tabla_control, c.column_name), ', ')
    INTO v_columnas, v_expresiones
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_tabla_control
    AND c.column_name <> 'id'
    AND p_control ? c.column_name;

  IF v_columnas IS NULL THEN
    RAISE EXCEPTION 'El control no contiene columnas reconocidas para %', p_tabla_control;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (%s) SELECT %s RETURNING id',
    p_tabla_control, v_columnas, v_expresiones
  ) INTO v_id_control USING p_control;

  IF p_anomalia IS NOT NULL AND jsonb_typeof(p_anomalia) = 'object' THEN
    IF NULLIF(btrim(coalesce(p_anomalia->>'anomalia_detectada','')), '') IS NULL THEN
      RAISE EXCEPTION 'La descripción de la anomalía es obligatoria';
    END IF;

    v_anomalia := p_anomalia || jsonb_build_object(
      'tabla_control', p_tabla_control,
      'id_control', v_id_control,
      'estado_resolucion', coalesce(nullif(p_anomalia->>'estado_resolucion',''), 'Abierta')
    );

    SELECT string_agg(format('%I', c.column_name), ', '),
           string_agg(format('(jsonb_populate_record(NULL::public.anomalias, $1)).%I', c.column_name), ', ')
      INTO v_columnas, v_expresiones
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'anomalias'
      AND c.column_name <> 'id'
      AND v_anomalia ? c.column_name;

    EXECUTE format(
      'INSERT INTO public.anomalias (%s) SELECT %s RETURNING id',
      v_columnas, v_expresiones
    ) INTO v_id_anomalia USING v_anomalia;
  END IF;

  RETURN jsonb_build_object(
    'id_control', v_id_control,
    'id_anomalia', v_id_anomalia,
    'anomalia_creada', v_id_anomalia IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_control_con_anomalia(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_control_con_anomalia(text, jsonb, jsonb) TO anon, authenticated;
