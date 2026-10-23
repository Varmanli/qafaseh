import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { getClientKey, rateLimit } from "./rate-limit";

test("client IP ignores untrusted headers and uses only the configured ingress header", () => {
  const previous = process.env.TRUSTED_CLIENT_IP_HEADER;
  try {
    delete process.env.TRUSTED_CLIENT_IP_HEADER;
    const request = new NextRequest("http://localhost", { headers: { "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3, 4.4.4.4" } });
    assert.equal(getClientKey(request, "login"), "login:unknown");
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
    assert.equal(getClientKey(request, "login"), "login:4.4.4.4");
    assert.equal(getClientKey(new NextRequest("http://localhost", { headers: { "x-forwarded-for": "garbage" } }), "login"), "login:unknown");
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_CLIENT_IP_HEADER;
    else process.env.TRUSTED_CLIENT_IP_HEADER = previous;
  }
});

test("local limiter blocks after its allowance", () => {
  const key = `test:${Math.random()}`;
  assert.equal(rateLimit(key, { limit: 2 }).allowed, true);
  assert.equal(rateLimit(key, { limit: 2 }).remaining, 0);
  const denied = rateLimit(key, { limit: 2 });
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterSeconds > 0);
});

test("local limiter refuses new identities once its memory budget is full", () => {
  let allowed = 0;
  for (let index = 0; index < 10_001; index++) {
    if (rateLimit(`capacity-test:${index}`, { windowMs: 60_000 }).allowed) allowed++;
  }
  assert.ok(allowed <= 10_000);
  assert.equal(rateLimit("capacity-test:overflow").allowed, false);
});
