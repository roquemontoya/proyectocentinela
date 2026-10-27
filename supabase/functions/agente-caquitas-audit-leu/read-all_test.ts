import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readAll } from "./read-all.ts";

Deno.test("readAll paginates in 500-row pages and preserves every row", async () => {
  const offsets: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    offsets.push(url.searchParams.get("offset") ?? "");
    const offset = Number(url.searchParams.get("offset"));
    const rows = Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => ({ id: offset + i + 1 }));
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  };
  const rows = await readAll("https://example.supabase.co", "test-key", "demo", fetcher);
  assertEquals(rows.length, 501);
  assertEquals(offsets, ["0", "500"]);
});

Deno.test("readAll returns empty list for an empty table", async () => {
  const fetcher: typeof fetch = async () => new Response("[]", { status: 200 });
  assertEquals(await readAll("https://example.supabase.co", "test-key", "empty", fetcher), []);
});

Deno.test("readAll fails closed on HTTP errors", async () => {
  const fetcher: typeof fetch = async () => new Response("denied", { status: 403 });
  await assertRejects(() => readAll("https://example.supabase.co", "test-key", "private", fetcher), Error, "read_failed:private:403");
});

Deno.test("readAll rejects non-array responses", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ error: "bad shape" }), { status: 200 });
  await assertRejects(() => readAll("https://example.supabase.co", "test-key", "bad-shape", fetcher), Error, "invalid_response:bad-shape");
});
