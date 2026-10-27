import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateAuditRequest } from "./request-validation.ts";

const validBody = JSON.stringify({
  agent_id: "AGENTE-CAQUITAS-001",
  mayordomo_id: "EL_MAYORDOMO_001",
  task_id: "auditoria-integral-leu",
});
const request = (method = "POST", token = "secret", body = validBody) =>
  new Request("https://example.test/audit", {
    method,
    headers: { "x-agent-token": token, "content-type": "application/json" },
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });

Deno.test("request guard rejects non-POST requests", async () => {
  assertEquals(await validateAuditRequest(request("GET"), "secret"), {
    ok: false, status: 405, error: "method_not_allowed",
  });
});

Deno.test("request guard rejects missing server token and bad supplied token", async () => {
  assertEquals(await validateAuditRequest(request(), ""), {
    ok: false, status: 503, error: "agent_token_not_configured",
  });
  assertEquals(await validateAuditRequest(request("POST", "wrong"), "secret"), {
    ok: false, status: 401, error: "unauthorized",
  });
  assertEquals(await validateAuditRequest(request("POST", ""), "secret"), {
    ok: false, status: 401, error: "unauthorized",
  });
});

Deno.test("request guard rejects invalid JSON and disallowed tasks", async () => {
  assertEquals(await validateAuditRequest(request("POST", "secret", "{"), "secret"), {
    ok: false, status: 400, error: "invalid_json",
  });
  assertEquals(await validateAuditRequest(request("POST", "secret", "{}"), "secret"), {
    ok: false, status: 400, error: "task_not_allowed",
  });
  assertEquals(await validateAuditRequest(request("POST", "secret", "[]"), "secret"), {
    ok: false, status: 400, error: "task_not_allowed",
  });
});

Deno.test("request guard accepts only the expected auditor envelope", async () => {
  const result = await validateAuditRequest(request(), "secret");
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.body.task_id, "auditoria-integral-leu");
});
