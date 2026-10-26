/**
 * Safe black-box security checks for the Centinela audit Edge Functions.
 *
 * Required env:
 *   CENTINELA_STAGING_SUPABASE_URL  URL of an isolated Supabase test project.
 *   AGENTE_CAQ_AUDIT_TOKEN           Test-only token configured in that project.
 *
 * This script deliberately refuses the known production project URL and sends
 * only GET requests plus unauthenticated/incorrect-token POST requests. It does
 * not create, update, or delete data.
 */
import assert from "node:assert/strict";

const base = process.env.CENTINELA_STAGING_SUPABASE_URL;
const token = process.env.AGENTE_CAQ_AUDIT_TOKEN;
if (!base || !token) {
  console.error("Falta CENTINELA_STAGING_SUPABASE_URL o AGENTE_CAQ_AUDIT_TOKEN.");
  process.exit(2);
}
const parsed = new URL(base);
if (parsed.protocol !== "https:") throw new Error("La URL de prueba debe usar HTTPS.");
if (parsed.hostname === "zgzhudcdxoentmfgdncf.supabase.co" || parsed.hostname.startsWith("zgzhudcdxoentmfgdncf.")) {
  throw new Error("Bloqueado: esta es la URL conocida de producción; usa un proyecto aislado.");
}
if (token.length < 8) throw new Error("El token de prueba parece demasiado corto.");

// GET is tested only on report/read functions: Mayordomo has verify_jwt=true,
// so the Supabase gateway may reject an unauthenticated GET before the handler.
// Its unauthenticated POST is tested separately below.
const getRestrictedFunctions = [
  "agente-caquitas-audit-report",
  "agente-caquitas-audit-read",
];
const results = [];

async function request(name, method, headers = {}, body) {
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/${name}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
    redirect: "manual",
  });
  let payload = "";
  try { payload = await response.text(); } catch {}
  return { status: response.status, body: payload };
}
function record(test, ok, detail) {
  results.push({ test, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${test}: ${detail}`);
}

for (const name of getRestrictedFunctions) {
  try {
    const r = await request(name, "GET");
    record(`${name}: GET bloqueado`, r.status === 405, `HTTP ${r.status}`);
  } catch (e) {
    record(`${name}: GET bloqueado`, false, String(e));
  }
}

for (const name of ["agente-caquitas-audit-report", "agente-caquitas-audit-read"]) {
  try {
    const r = await request(name, "POST", { "content-type": "application/json" }, "{}");
    const parsedBody = (() => { try { return JSON.parse(r.body); } catch { return {}; } })();
    record(`${name}: POST sin token`, r.status === 401 && parsedBody.error === "unauthorized",
      `HTTP ${r.status}; error=${parsedBody.error ?? "no-json"}`);
  } catch (e) {
    record(`${name}: POST sin token`, false, String(e));
  }
  try {
    const r = await request(name, "POST", {
      "content-type": "application/json",
      "x-agent-token": `${token}-incorrecto`,
    }, JSON.stringify({
      agent_id: "AGENTE-CAQUITAS-001",
      mayordomo_id: "EL_MAYORDOMO_001",
      task_id: name.endsWith("-read") ? "auditoria-extintores" : "auditoria-extintores-resumen",
    }));
    const parsedBody = (() => { try { return JSON.parse(r.body); } catch { return {}; } })();
    record(`${name}: POST token incorrecto`, r.status === 401 && parsedBody.error === "unauthorized",
      `HTTP ${r.status}; error=${parsedBody.error ?? "no-json"}`);
  } catch (e) {
    record(`${name}: POST token incorrecto`, false, String(e));
  }
}

try {
  const r = await request("mayordomo-001-audit", "POST", { "content-type": "application/json" }, "{}");
  const parsedBody = (() => { try { return JSON.parse(r.body); } catch { return {}; } })();
  record("Mayordomo: POST sin sesión", r.status === 401,
    `HTTP ${r.status}; error=${parsedBody.error ?? "no-json"}`);
} catch (e) {
  record("Mayordomo: POST sin sesión", false, String(e));
}

const failed = results.filter(r => !r.ok);
console.log(`\nResultado: ${results.length - failed.length}/${results.length} comprobaciones superadas.`);
if (failed.length) process.exitCode = 1;
