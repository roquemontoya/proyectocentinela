import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isCompatibleReplacement, normalizeExtinguisherType, parseExpiry } from "./audit-rules.ts";

Deno.test("parseExpiry accepts MM/YY and MM/YYYY", () => {
  assertEquals(parseExpiry("06/27"), { month: 6, year: 2027 });
  assertEquals(parseExpiry("06/2027"), { month: 6, year: 2027 });
  assertEquals(parseExpiry(" 12/2099 "), { month: 12, year: 2099 });
});

Deno.test("parseExpiry rejects missing, malformed and out-of-range dates", () => {
  for (const value of ["", " ", "6/2", "2027/06", "00/2027", "13/2027", "06/1999", "06/2201", "06/20277", "06-2027"]) {
    assertEquals(parseExpiry(value), null, `Expected invalid expiry: ${value}`);
  }
  assertEquals(parseExpiry(null), null);
});

Deno.test("type normalization ignores accents, case and surrounding spaces", () => {
  assertEquals(normalizeExtinguisherType("  HÁLON "), "halon");
  assertEquals(normalizeExtinguisherType("CO2"), "co2");
});

Deno.test("replacement matrix follows Centinela rules", () => {
  for (const type of ["PQS", "Halon", "CO2"]) assertEquals(isCompatibleReplacement("PQS", type), true);
  assertEquals(isCompatibleReplacement("Halon", "Halon"), true);
  assertEquals(isCompatibleReplacement("Halon", "CO2"), false);
  assertEquals(isCompatibleReplacement("CO2", "Halon"), true);
  assertEquals(isCompatibleReplacement("CO2", "PQS"), false);
  assertEquals(isCompatibleReplacement("K", "K"), true);
  assertEquals(isCompatibleReplacement("K", "CO2"), false);
  assertEquals(isCompatibleReplacement("unknown", "K"), null);
});
