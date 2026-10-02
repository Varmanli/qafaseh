import { performance } from "node:perf_hooks";

const url = process.argv[2] ?? "http://localhost:3000/book/ژرمینال";
const measurements = [];
for (let run = 0; run < 6; run++) {
  const started = performance.now();
  const response = await fetch(url);
  const headersMs = performance.now() - started;
  let html = "";
  let contentMs;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    html += decoder.decode(chunk, { stream: true });
    if (contentMs === undefined && html.includes("<h1")) contentMs = performance.now() - started;
  }
  const measurement = { run, status: response.status, headersMs: Math.round(headersMs),
    contentMs: contentMs === undefined ? null : Math.round(contentMs),
    totalMs: Math.round(performance.now() - started), bytes: Buffer.byteLength(html),
    hasCommunity: html.includes("یادداشت‌های کاربران درباره کتاب") };
  console.log(JSON.stringify(measurement));
  if (response.status !== 200 || contentMs === undefined || !measurement.hasCommunity) {
    throw new Error("Book page failed to render its content");
  }
  if (run > 0) measurements.push(measurement);
}
const median = (key) => measurements.map((row) => row[key]).sort((a, b) => a - b)[2];
console.log(JSON.stringify({ url, warmMedian: { headersMs: median("headersMs"),
  contentMs: median("contentMs"), totalMs: median("totalMs") } }));
