import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { isAllowedMutationOrigin, readJsonBody, readFormDataBody } from "./request";
import { proxy, config } from "@/proxy";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";

test("production mutation origins cannot be forged through Host or forwarding headers", () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production", APP_URL: "https://site.example", NEXT_PUBLIC_APP_URL: "" });
    const request = (headers: HeadersInit) => new Request("http://internal:3000/api/profile", { method: "POST", headers });
    assert.equal(isAllowedMutationOrigin(request({ origin: "https://site.example" })), true);
    const deniedHeaders: Record<string, string>[] = [
      { origin: "https://evil.example", "x-forwarded-host": "evil.example", host: "evil.example" },
      { origin: "null" },
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
      { referer: "https://evil.example/form" },
    ];
    for (const headers of deniedHeaders) assert.equal(isAllowedMutationOrigin(request(headers)), false);
    assert.equal(isAllowedMutationOrigin(request({ "sec-fetch-site": "same-origin" })), true);
    assert.equal(isAllowedMutationOrigin(request({ authorization: "Bearer worker-token" })), true);
    const denied = proxy(new NextRequest("http://internal:3000/api/auth/login", { method: "POST", headers: { origin: "https://evil.example" } }));
    assert.equal(denied.status, 403);
    assert.match(denied.headers.get("cache-control")!, /private, no-store/);
    assert.equal(proxy(new NextRequest("http://internal:3000/api/auth/me")).headers.get("cache-control"), "private, no-store");
    assert.equal(proxy(new NextRequest("http://internal:3000/api/profile", { method: "POST", headers: { "content-length": "1048577" } })).status, 413);
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: "/api/auth/login" }), true);
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: "/api/quotes/id/like" }), true);
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: "/api/admin/books/import-links/preview" }), true);
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: "/api/admin/book-covers/bulk-upload" }), false);
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: "/api/upload/image" }), false);
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: "/_next/static/chunk.js" }), false);
  } finally {
    for (const key of ["NODE_ENV", "APP_URL", "NEXT_PUBLIC_APP_URL"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test("development accepts equivalent loopback hosts only at the same port and protocol", () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "development" });
    const request = (origin: string, url = "http://localhost:3005/api/auth/login", site?: string) => new Request(url, { method: "POST", headers: { origin, ...(site ? { "sec-fetch-site": site } : {}) } });
    for (const origin of ["http://127.0.0.1:3005", "http://[::1]:3005", "http://localhost:3005"]) assert.equal(isAllowedMutationOrigin(request(origin)), true);
    for (const origin of ["http://localhost:3000", "https://localhost:3005", "https://evil.example", "http://localhost:3005.evil.example", "null", "http://127.0.0.1:3005/path"]) assert.equal(isAllowedMutationOrigin(request(origin)), false);
    assert.equal(isAllowedMutationOrigin(request("http://127.0.0.1:3005", "http://localhost:3005/api", "cross-site")), false);
    assert.equal(isAllowedMutationOrigin(request("http://localhost:3005", "http://internal:3005/api")), false);
    Object.assign(process.env, { NODE_ENV: "production", APP_URL: "http://localhost:3005", NEXT_PUBLIC_APP_URL: "" });
    assert.equal(isAllowedMutationOrigin(request("http://127.0.0.1:3005")), false);
  } finally {
    for (const name of ["NODE_ENV", "APP_URL", "NEXT_PUBLIC_APP_URL"]) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});

test("bounded JSON reader rejects actual streamed oversize bodies without Content-Length", async () => {
  const makeRequest = (body: string, headers = { "content-type": "application/json" }) => new Request("http://localhost/api", { method: "POST", headers, body });
  assert.deepEqual(await readJsonBody(makeRequest('{"ok":true}')), { ok: true });
  await assert.rejects(readJsonBody(makeRequest("{")), { status: 400 });
  await assert.rejects(readJsonBody(makeRequest("x", { "content-type": "text/plain" })), { status: 415 });
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('"' + "ش".repeat(20)));
    controller.enqueue(new TextEncoder().encode('"'));
    controller.close();
  } });
  const request = new Request("http://localhost/api", { method: "POST", body: stream, headers: { "content-type": "application/json" }, duplex: "half" } as RequestInit);
  await assert.rejects(readJsonBody(request, 32), { status: 413 });
});

test("multipart reader counts real streamed bytes, including oversized text fields", async () => {
  const makeRequest = () => {
    const form = new FormData();
    form.set("folder", "avatars");
    form.set("file", new File(["image-content"], "image.png", { type: "image/png" }));
    return new Request("http://localhost/api/upload/image", { method: "POST", body: form });
  };
  const form = await readFormDataBody(makeRequest(), 4096);
  assert.equal(form.get("folder"), "avatars");
  assert.equal((form.get("file") as File).name, "image.png");
  await assert.rejects(readFormDataBody(makeRequest(), 16), { status: 413 });
  const crossSite = makeRequest();
  crossSite.headers.set("origin", "https://evil.example");
  await assert.rejects(readFormDataBody(crossSite), { status: 403 });
  const largeField = new FormData();
  largeField.set("folder", "x".repeat(4096));
  await assert.rejects(readFormDataBody(new Request("http://localhost/api", { method: "POST", body: largeField }), 1024), { status: 413 });
  const bulk = new FormData();
  bulk.set("files", new File([new Uint8Array(11 * 1024 * 1024)], "bulk.png"));
  const parsedBulk = await readFormDataBody(new Request("http://localhost/api", { method: "POST", body: bulk }), 12 * 1024 * 1024);
  assert.equal((parsedBulk.get("files") as File).size, 11 * 1024 * 1024);
});
