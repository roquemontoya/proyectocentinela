export type AuditRequestBody = Record<string, unknown>;

export type AuditRequestResult =
  | { ok: true; body: AuditRequestBody }
  | { ok: false; status: number; error: string };

function equalSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Validates the auditor's HTTP method, shared secret, JSON and task envelope. */
export async function validateAuditRequest(
  req: Request,
  expectedToken: string,
): Promise<AuditRequestResult> {
  if (req.method !== "POST") return { ok: false, status: 405, error: "method_not_allowed" };
  if (!expectedToken) return { ok: false, status: 503, error: "agent_token_not_configured" };
  const supplied = req.headers.get("x-agent-token") ?? "";
  if (!supplied || !equalSecret(expectedToken, supplied)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "task_not_allowed" };
  }
  const candidate = body as AuditRequestBody;
  if (candidate.agent_id !== "AGENTE-CAQUITAS-001" ||
      candidate.mayordomo_id !== "EL_MAYORDOMO_001" ||
      candidate.task_id !== "auditoria-integral-leu") {
    return { ok: false, status: 400, error: "task_not_allowed" };
  }
  return { ok: true, body: candidate };
}
