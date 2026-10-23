import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("password signup keeps phone unverified and preserves secure OTP flows", { skip: !process.env.SECURITY_TEST_DATABASE_URL }, async (t) => {
  const url = new URL(process.env.SECURITY_TEST_DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/ghafaseh_security_test");
  Object.assign(process.env, { DATABASE_URL: url.toString(), JWT_SECRET: "isolated-signup-test-secret-at-least-32-characters", SIGNUP_OTP_ENABLED: "false", SMS_OTP_ENABLED: "true", SMS_DEV_MODE: "true", TRUSTED_CLIENT_IP_HEADER: "x-test-ip" });
  const { db, pool } = await import("@/db");
  const { User, SmsVerificationCode, SecurityRateLimit } = await import("@/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { startPhoneSignup, registerPhoneUser } = await import("./phone-signup");
  const { authenticateUser } = await import("./service");
  const { verifyJwt } = await import("@/lib/jwt");
  const { POST: start } = await import("@/app/api/auth/signup/phone/route");
  const { POST: signup } = await import("@/app/api/auth/signup/route");
  const { POST: login } = await import("@/app/api/auth/login/route");
  const { POST: requestCode } = await import("@/app/api/auth/sms/request-code/route");
  const { POST: verifyCode } = await import("@/app/api/auth/sms/verify-code/route");
  const { issueSmsOtp, verifySmsOtp } = await import("./sms-otp");
  const originalFetch = globalThis.fetch;
  let smsCalls = 0;
  globalThis.fetch = (async () => { smsCalls++; throw new Error("unexpected outbound request"); }) as typeof fetch;
  const phones = Array.from({ length: 5 }, () => `+989${Math.floor(100_000_000 + Math.random() * 900_000_000)}`);
  const password = "MyBookShelf482!";
  let ip = 1;
  function request(body: unknown, fixedIp?: string) {
    return new NextRequest("http://localhost/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json", "x-test-ip": fixedIp ?? `127.1.0.${ip++}` }, body: JSON.stringify(body) });
  }
  const input = (phone: string, token: string) => ({ phone, token, password, confirmPassword: password });
  try {
    await t.test("phone step validates without creating accounts; final API rejects bypass and weak passwords", async () => {
      assert.equal((await start(request({ phone: "02112345678" }))).status, 422);
      assert.equal((await signup(request({ ...input(phones[0], "forged") }))).status, 403);
      const step = await startPhoneSignup({ phone: phones[0] });
      for (const body of [{ ...input(phones[0], step.token), password: "Password123!", confirmPassword: "Password123!" }, { ...input(phones[0], step.token), confirmPassword: "different" }, input(phones[1], step.token)]) {
        assert.ok((await signup(request(body))).status >= 400);
      }
      assert.equal((await db.select().from(User).where(inArray(User.phone, phones))).length, 0);
    });
    await t.test("successful API signup creates a hashed unverified account, session and password login", async () => {
      const local = `0${phones[0].slice(3)}`;
      const arabic = local.replace(/\d/g, (digit) => String.fromCharCode(1632 + Number(digit)));
      const response = await start(request({ phone: arabic }));
      const step = await response.json();
      assert.equal(step.phone, phones[0]);
      const result = await signup(request(input(local, step.token)));
      assert.equal(result.status, 201);
      const payload = await result.json();
      const cookie = result.headers.get("set-cookie")!;
      assert.match(cookie, /HttpOnly/i);
      assert.equal(verifyJwt(cookie.split(";")[0].split("=")[1])?.id, payload.user.id);
      const [user] = await db.select().from(User).where(eq(User.id, payload.user.id));
      assert.equal(user.phoneVerified, null);
      assert.equal(user.emailVerified, null);
      assert.equal(user.phone, phones[0]);
      assert.equal(user.authProvider, "password");
      assert.match(user.passwordHash!, /^\$2[aby]\$/);
      assert.equal(user.password, user.passwordHash);
      assert.doesNotMatch(JSON.stringify(payload), /password|Hash/);
      assert.equal((await login(request({ identifier: arabic, password, rememberMe: true }))).status, 200);
      assert.equal((await authenticateUser({ identifier: local, password })).id, user.id);
      assert.equal((await start(request({ phone: `0098${phones[0].slice(3)}` }))).status, 409);
      assert.equal((await signup(request(input(local, step.token)))).status, 409);
      assert.equal((await db.select().from(SmsVerificationCode).where(eq(SmsVerificationCode.phone, phones[0]))).length, 0);
      assert.equal(smsCalls, 0);
    });
    await t.test("concurrent signup creates one account and leaves an existing owner's password intact", async () => {
      const step = await startPhoneSignup({ phone: phones[1] });
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => registerPhoneUser(input(phones[1], step.token))));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal((await db.select().from(User).where(eq(User.phone, phones[1]))).length, 1);
      await assert.rejects(registerPhoneUser({ ...input(phones[1], step.token), password: "OtherBookShelf123", confirmPassword: "OtherBookShelf123" }), { code: "PHONE_TAKEN" });
      await authenticateUser({ identifier: phones[1], password });
    });
    await t.test("unverified phone cannot recover a password or log in by OTP; same authenticated account can verify later", async () => {
      assert.deepEqual(await issueSmsOtp(phones[0], "recovery"), {});
      await assert.rejects(verifySmsOtp(phones[0], "123456", "recovery"), { code: "INVALID_CODE" });
      const challenge = await issueSmsOtp(phones[0], "login");
      await assert.rejects(verifySmsOtp(phones[0], challenge.devCode!, "login"), { code: "PHONE_NOT_VERIFIED" });
      const user = await authenticateUser({ identifier: phones[0], password });
      await pool.query('UPDATE "SmsVerificationCode" SET created_at = $2 WHERE phone = $1', [phones[0], new Date(Date.now() - 61_000).toISOString()]);
      const link = await issueSmsOtp(phones[0], "link", user.id);
      await verifySmsOtp(phones[0], link.devCode!, "link", user.id, user.sessionVersion);
      const [stored] = await db.select().from(User).where(eq(User.id, user.id));
      assert.ok(stored.phoneVerified);
      await authenticateUser({ identifier: phones[0], password });
    });
    await t.test("server flag blocks password signup even with an older ticket, while enabled OTP still works", async () => {
      const step = await startPhoneSignup({ phone: phones[2] });
      const disabled = await requestCode(request({ phone: phones[2], purpose: "signup" }));
      assert.equal(disabled.status, 403);
      assert.equal(smsCalls, 0);
      process.env.SIGNUP_OTP_ENABLED = "true";
      assert.equal((await start(request({ phone: phones[2] }))).status, 403);
      assert.equal((await signup(request(input(phones[2], step.token)))).status, 403);
      const sent = await requestCode(request({ phone: phones[2], purpose: "signup" }));
      assert.equal(sent.status, 200);
      const challenge = await sent.json();
      const verified = await verifyCode(request({ phone: phones[2], purpose: "signup", code: challenge.devCode, password, confirmPassword: password }));
      assert.equal(verified.status, 200);
      const [stored] = await db.select().from(User).where(eq(User.phone, phones[2]));
      assert.ok(stored.phoneVerified);
      process.env.SIGNUP_OTP_ENABLED = "false";
    });
    await t.test("shared limits bound both phone checks and final submissions", async () => {
      const address = "127.2.0.1";
      for (let attempt = 0; attempt < 10; attempt++) assert.equal((await start(request({ phone: phones[3] }, address))).status, 200);
      assert.equal((await start(request({ phone: phones[3] }, address))).status, 429);
      const step = await startPhoneSignup({ phone: phones[4] });
      for (let attempt = 0; attempt < 5; attempt++) await signup(request(input(phones[4], "forged"), "127.2.0.2"));
      assert.equal((await signup(request(input(phones[4], step.token), "127.2.0.2"))).status, 429);
      assert.equal((await db.select().from(User).where(eq(User.phone, phones[4]))).length, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await db.delete(SmsVerificationCode).where(inArray(SmsVerificationCode.phone, phones));
    await db.delete(User).where(inArray(User.phone, phones));
    await db.delete(SecurityRateLimit);
    await pool.end();
  }
});
