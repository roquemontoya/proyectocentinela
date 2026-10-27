export type AuditRow = Record<string, unknown>;

export async function readAll(
  base: string,
  key: string,
  table: string,
  fetcher: typeof fetch = fetch,
): Promise<AuditRow[]> {
  const result: AuditRow[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const url = new URL("/rest/v1/" + encodeURIComponent(table), base);
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", String(size));
    url.searchParams.set("offset", String(offset));
    const res = await fetcher(url, { headers: { apikey: key, Accept: "application/json" } });
    if (!res.ok) throw new Error("read_failed:" + table + ":" + res.status);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error("invalid_response:" + table);
    result.push(...page);
    if (page.length < size) return result as AuditRow[];
  }
}
