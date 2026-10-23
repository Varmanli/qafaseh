import { readFile } from "node:fs/promises";

// Read-only HTTP measurements against a locally started production build.
async function main() {
  const base = new URL(process.env.PERF_BASE_URL ?? "http://127.0.0.1:3107");
  if (!["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Benchmark only a local isolated server");
  const routes = process.argv.slice(2);
  if (!routes.length) routes.push("/", "/books", "/authors", "/sitemap.xml");
  const counterFile = process.env.PERF_QUERY_COUNTER_FILE;
  const counter = async (): Promise<number | undefined> => {
    if (!counterFile) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return JSON.parse(await readFile(counterFile, "utf8")).count;
  };
  const results = [];
  for (const route of routes) {
    const url = new URL(route, base);
    if (url.origin !== base.origin || !route.startsWith("/")) throw new Error("Routes must remain on the local origin");
    const firstCount = await counter();
    let start = performance.now();
    let response = await fetch(url);
    let body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${route}`);
    const firstMs = performance.now() - start;
    const afterFirst = await counter();
    const samples = [];
    let bytes = 0;
    for (let sample = 0; sample < 5; sample++) {
      start = performance.now();
      response = await fetch(url);
      body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${route}`);
      samples.push(performance.now() - start);
      bytes = Buffer.byteLength(body);
    }
    const afterWarm = await counter();
    results.push({ route, firstMs: Math.round(firstMs), medianWarmMs: Math.round(samples.sort((a, b) => a - b)[2]), bytes,
      firstQueries: firstCount === undefined ? undefined : afterFirst! - firstCount,
      warmQueriesPerRequest: afterWarm === undefined ? undefined : (afterWarm - afterFirst!) / 5 });
  }
  console.log(JSON.stringify({ scenario: process.env.PERF_SCENARIO ?? "local", results }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
