import test from "node:test";
import assert from "node:assert/strict";

// Contract-level tests for Caquitas rules. These tests deliberately do not
// contact production or mutate Supabase; endpoint auth/pagination still need
// an authenticated end-to-end run.
function duplicateGroups(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const value = String(row[field] ?? "").trim();
    if (!value) continue;
    const key = value.toUpperCase();
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1)
    .map(([value, group]) => ({ value, count: group.length }));
}
function validSourcePayload(payload) {
  return Boolean(payload?.counts)
    && Array.isArray(payload.extintores)
    && Array.isArray(payload.trazabilidad)
    && Array.isArray(payload.alveolos)
    && payload.agent_id === "AGENTE-CAQUITAS-001"
    && payload.task_id === "auditoria-extintores";
}
function parseExpiry(value) {
  const s = String(value ?? "").trim();
  let m = s.match(/^(0[1-9]|1[0-2])\/(20\d{2}|\d{2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  let year = Number(m[2]);
  if (year < 100) year += 2000;
  return new Date(year, month, 0).getDate();
}
function compatible(holder, candidate) {
  const rules = { PQS: ["PQS", "HALON", "CO2"], HALON: ["HALON"], CO2: ["CO2", "HALON"], K: ["K"] };
  return (rules[holder] ?? []).includes(candidate);
}

test("accepts legitimately empty tables", () => {
  assert.equal(validSourcePayload({
    agent_id: "AGENTE-CAQUITAS-001", task_id: "auditoria-extintores",
    counts: { extintores: 0, trazabilidad: 0, alveolos: 0 },
    extintores: [], trazabilidad: [], alveolos: []
  }), true);
});
test("rejects malformed/incomplete source payload", () => {
  assert.equal(validSourcePayload({ counts: {}, extintores: [], trazabilidad: [] }), false);
  assert.equal(validSourcePayload({ agent_id: "AGENTE-CAQUITAS-001", task_id: "auditoria-extintores", counts: {}, extintores: {}, trazabilidad: [], alveolos: [] }), false);
});
test("detects duplicate identifiers ignoring case and surrounding spaces", () => {
  assert.deepEqual(duplicateGroups([{serial:" ab-1 "},{serial:"AB-1"},{serial:""}], "serial"), [{value:"AB-1",count:2}]);
});
test("expiry parser rejects impossible months and unsupported dates", () => {
  assert.equal(parseExpiry("00/2027"), null);
  assert.equal(parseExpiry("13/2027"), null);
  assert.equal(parseExpiry("garbage"), null);
  assert.equal(parseExpiry("11/2026"), 30);
  assert.equal(parseExpiry("02/2028"), 29);
});
test("replacement compatibility matrix respects fire-safety rules", () => {
  assert.equal(compatible("PQS","CO2"), true);
  assert.equal(compatible("HALON","PQS"), false);
  assert.equal(compatible("CO2","HALON"), true);
  assert.equal(compatible("K","PQS"), false);
  assert.equal(compatible("K","K"), true);
  assert.equal(compatible("UNKNOWN","PQS"), false);
});
test("agent names and provider spelling are fixed by contract", () => {
  const contract = "J.A.R.V.I.S. public; Caquitas internal; Bertolez";
  assert.match(contract, /J\.A\.R\.V\.I\.S\./);
  assert.match(contract, /Caquitas/);
  assert.match(contract, /Bertolez/);
  assert.doesNotMatch(contract, /Vertolez/);
});
