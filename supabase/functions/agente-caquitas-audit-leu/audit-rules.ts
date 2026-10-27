export function normalizeExtinguisherType(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isCompatibleReplacement(titularValue: unknown, replacementValue: unknown): boolean | null {
  const titular = normalizeExtinguisherType(titularValue);
  const replacement = normalizeExtinguisherType(replacementValue);
  if (titular === "pqs") return ["pqs", "halon", "co2"].includes(replacement);
  if (titular === "halon") return replacement === "halon";
  if (titular === "co2") return ["co2", "halon"].includes(replacement);
  if (titular === "k") return replacement === "k";
  return null;
}

export type ParsedExpiry = { month: number; year: number } | null;

/** Parses the legacy MM/YY or MM/YYYY format; null means malformed or out of range. */
export function parseExpiry(value: unknown): ParsedExpiry {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  let year = Number(match[2]);
  if (match[2].length === 2) year += 2000;
  if (month < 1 || month > 12 || year < 2000 || year > 2200) return null;
  return { month, year };
}
