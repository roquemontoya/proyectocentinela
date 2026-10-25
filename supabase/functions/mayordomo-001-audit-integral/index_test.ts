import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runRules } from "./index.ts";

Deno.test("JARVIS detects orphaned control asset links", () => {
  const findings = runRules({
    leu: [],
    controles_e: [{ id: 7, id_activo: 999 }],
  });
  assert(findings.some((f) => f.code === "REL-001" && f.count === 1));
});

Deno.test("JARVIS detects Pulmón alveoli assigned to missing extinguisher", () => {
  const findings = runRules({
    Extintores: [],
    pulmon_alveolos: [{ id: 2, codigo: "A-02", activo_extintor_id: 404, estado: "Disponible" }],
  });
  assert(findings.some((f) => f.code === "PUL-001" && f.count === 1));
});

Deno.test("JARVIS detects impossible temporary replacement chronology", () => {
  const findings = runRules({
    reemplazos_temporales_extintores: [{
      id: 3,
      fecha_inicio: "2026-10-20",
      fecha_fin: "2026-10-19",
      activo_titular_id: 10,
      activo_reemplazo_id: 11,
    }],
  });
  assert(findings.some((f) => f.code === "REP-001" && f.count === 1));
});

Deno.test("JARVIS detects out-of-range GPS coordinates", () => {
  const findings = runRules({
    puntos_recorrido_gps: [{
      id: 1,
      recorrido_id: 5,
      secuencia: 1,
      latitud: 123,
      longitud: -64,
    }],
  });
  assert(findings.some((f) => f.code === "GPS-001" && f.count === 1));
});

Deno.test("JARVIS does not report issues for an empty dataset", () => {
  assertEquals(runRules({}), []);
});
