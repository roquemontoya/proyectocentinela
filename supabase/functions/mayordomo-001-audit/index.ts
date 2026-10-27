import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const trustedProduction = origin === "https://proyectocentinela.vercel.app";
  const trustedPreview = /^https:\/\/proyectocentinela-[a-z0-9-]+-acme-argentina\.vercel\.app$/.test(origin);
  const allowedOrigin = trustedProduction || trustedPreview ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return json(req, 401, { error: "authentication_required" });

  const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const agentToken = Deno.env.get("AGENTE_CAQ_AUDIT_TOKEN") ?? "";
  if (!baseUrl || !anonKey || !agentToken) {
    console.error("mayordomo_env_missing", {
      hasUrl: Boolean(baseUrl), hasAnonKey: Boolean(anonKey), hasAgentToken: Boolean(agentToken)
    });
    return json(req, 503, { error: "service_not_configured" });
  }

  const bearer = match[1];
  try {
    const userResponse = await fetch(new URL("/auth/v1/user", baseUrl), {
      headers: { apikey: anonKey, Authorization: `Bearer ${bearer}` }
    });
    if (!userResponse.ok) return json(req, 401, { error: "invalid_session" });
    const user = await userResponse.json();
    if (!user?.id) return json(req, 401, { error: "invalid_session" });

    const roleResponse = await fetch(new URL("/rest/v1/rpc/current_user_role", baseUrl), {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    if (!roleResponse.ok) {
      console.error("mayordomo_role_check_failed", roleResponse.status, (await roleResponse.text()).slice(0, 200));
      return json(req, 403, { error: "role_check_failed" });
    }
    const role = String(await roleResponse.json() ?? "").trim().toLowerCase();
    if (!["administrador", "superadministrador"].includes(role)) {
      return json(req, 403, { error: "insufficient_role" });
    }

    let requestedTask = "auditoria-extintores-resumen";
    try {
      const incoming = await req.clone().json();
      if (incoming && typeof incoming.task_id === "string") requestedTask = incoming.task_id;
    } catch { /* Empty request body preserves the legacy report behavior. */ }
    const allowedTasks: Record<string, string> = {
      "auditoria-extintores-resumen": "agente-caquitas-audit-report",
      "auditoria-integral-leu": "agente-caquitas-audit-leu",
    };
    const upstreamFunction = allowedTasks[requestedTask];
    if (!upstreamFunction) return json(req, 400, { error: "task_not_allowed" });

    const upstream = await fetch(new URL(`/functions/v1/${upstreamFunction}`, baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-token": agentToken },
      body: JSON.stringify({
        agent_id: "AGENTE-CAQUITAS-001",
        mayordomo_id: "EL_MAYORDOMO_001",
        task_id: requestedTask
      })
    });
    if (!upstream.ok) {
      console.error("mayordomo_audit_upstream_failed", upstream.status, (await upstream.text()).slice(0, 200));
      return json(req, 502, { error: "audit_unavailable" });
    }
    const report = await upstream.json();
    return json(req, 200, { ...report, presented_as: "Mayordomo_001" });
  } catch (error) {
    console.error("mayordomo_audit_failed", error instanceof Error ? error.message : "unknown");
    return json(req, 500, { error: "audit_failed" });
  }
});