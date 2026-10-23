import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { signJwt, verifyJwt } from "@/lib/jwt";
import { isAdmin } from "./roles";
import { loginSchema, registerApiSchema, resetPasswordApiSchema } from "@/lib/validations/auth";
import { updateProfileSchema } from "@/lib/validations/profile";

test("admin email allowlist requires verified ownership", () => {
  const previous = process.env.ADMIN_EMAILS;
  try {
    process.env.ADMIN_EMAILS = "admin@example.test";
    assert.equal(isAdmin({ role: "USER", email: "admin@example.test" }), false);
    assert.equal(isAdmin({ role: "USER", email: "admin@example.test", emailVerified: new Date() }), true);
    assert.equal(isAdmin({ role: "ADMIN" }), true);
    assert.equal(isAdmin(null), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previous;
  }
});

test("JWT rejects alternate algorithms, missing expiry/version, malformed claims and weak secrets", () => {
  const previous = process.env.JWT_SECRET;
  try {
    const secret = "security-test-secret-".repeat(3);
    process.env.JWT_SECRET = secret;
    assert.deepEqual(verifyJwt(signJwt({ id: "user", sessionVersion: 2 })), { id: "user", sessionVersion: 2 });
    for (const token of [
      jwt.sign({ id: "user", sessionVersion: 0 }, secret, { algorithm: "HS384", expiresIn: 60 }),
      jwt.sign({ id: "user", sessionVersion: 0 }, secret),
      jwt.sign({ id: "user" }, secret, { expiresIn: 60 }),
      jwt.sign({ id: {}, sessionVersion: 0 }, secret, { expiresIn: 60 }),
      jwt.sign({ id: "user", sessionVersion: "0" }, secret, { expiresIn: 60 }),
      jwt.sign({ id: "user", sessionVersion: -1 }, secret, { expiresIn: 60 }),
      jwt.sign({ id: "user", sessionVersion: 0 }, secret, { expiresIn: -1 }),
      "x".repeat(4097),
    ]) assert.equal(verifyJwt(token), null);
    process.env.JWT_SECRET = "change-me-to-a-long-random-secret-value";
    assert.throws(() => signJwt({ id: "user", sessionVersion: 0 }));
    process.env.JWT_SECRET = "short";
    assert.throws(() => signJwt({ id: "user", sessionVersion: 0 }));
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

test("auth inputs respect bcrypt's byte limit and bound login/reset input", () => {
  const input = { name: "Test", email: "test@example.test", password: "a1" + "ش".repeat(40) };
  assert.equal(registerApiSchema.safeParse(input).success, false);
  assert.equal(registerApiSchema.safeParse({ ...input, password: "a1" + "ش".repeat(35) }).success, true);
  assert.equal(loginSchema.safeParse({ identifier: "test", password: "x".repeat(1025), rememberMe: false }).success, false);
  assert.equal(resetPasswordApiSchema.safeParse({ token: "bad", password: "password123" }).success, false);
});

test("profile links reject executable protocols without throwing on malformed URLs", () => {
  for (const website of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "bad"])
    assert.equal(updateProfileSchema.safeParse({ website }).success, false);
  assert.equal(updateProfileSchema.safeParse({ website: "https://example.test" }).success, true);
});
