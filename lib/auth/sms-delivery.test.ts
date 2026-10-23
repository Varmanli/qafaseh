import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDigits, normalizeIranianPhone, smsRequestSchema, smsVerifySchema } from "./phone";
import { isSmsDevMode, isSmsDeliveryConfigured, sendSmsCode } from "./sms-delivery";

test("Iranian phone formats have one canonical identity", () => {
  for (const value of ["09123456789", "۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩", "+98 (912) 345-6789", "00989123456789", "989123456789"])
    assert.equal(normalizeIranianPhone(value), "+989123456789");
  for (const value of ["", "0912345678", "+449123456789", "091234567890", "9<script>123456789", "009809123456789"])
    assert.equal(normalizeIranianPhone(value), null);
  assert.equal(normalizeDigits("۱۲٣٤۵۶"), "123456");
  assert.equal(smsRequestSchema.parse({ phone: "09123456789" }).purpose, "login");
  assert.equal(smsVerifySchema.safeParse({ phone: "09123456789", code: "1234" }).success, false);
  assert.equal(smsVerifySchema.safeParse({ phone: "09123456789", code: "123456", purpose: "signup" }).success, false);
  assert.equal(smsVerifySchema.parse({ phone: "09123456789", code: "123456", purpose: "signup", password: "SignupPassword123", name: "  دوست کتاب  " }).name, "دوست کتاب");
  assert.equal(smsVerifySchema.safeParse({ phone: "09123456789", code: "123456", purpose: "signup", password: "weak" }).success, false);
  assert.equal(smsVerifySchema.safeParse({ phone: "09123456789", code: "123456", purpose: "signup", password: "SignupPassword123" }).success, true);
  assert.equal(smsRequestSchema.parse({ phone: "09123456789", purpose: "recovery" }).purpose, "recovery");
});

test("SMS uses the approved provider template and never exposes secret-bearing failures", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, { NODE_ENV: "production", SMS_PROVIDER: "kavenegar", SMS_DEV_MODE: "true", KAVENEGAR_API_KEY: "test-private-key", KAVENEGAR_OTP_TEMPLATE: "qafasehOtp" });
    assert.equal(isSmsDevMode(), false);
    let calls = 0;
    globalThis.fetch = (async (url, init) => {
      calls++;
      assert.equal(String(url), "https://api.kavenegar.com/v1/test-private-key/verify/lookup.json");
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("receptor"), "09123456789");
      assert.equal(body.get("token"), "123456");
      assert.equal(body.get("template"), "qafasehOtp");
      assert.equal(body.get("type"), "sms");
      return Response.json({ return: { status: 200 }, entries: [{ messageid: 123, status: 5 }] });
    }) as typeof fetch;
    await sendSmsCode("+989123456789", "123456");
    assert.equal(calls, 1);
    for (const payload of [
      { return: { status: 418 }, entries: [] },
      { return: { status: 200 }, entries: [{ messageid: 123, status: 6 }] },
      { return: { status: 200 }, entries: [] },
    ]) {
      globalThis.fetch = (async () => Response.json(payload)) as typeof fetch;
      await assert.rejects(sendSmsCode("09123456789", "123456"), { code: "SMS_DELIVERY_FAILED" });
    }
    globalThis.fetch = (async () => { throw new Error("https://api.kavenegar.com/v1/test-private-key secret failure"); }) as typeof fetch;
    await assert.rejects(sendSmsCode("09123456789", "123456"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /test-private-key|https:/);
      return true;
    });
    delete process.env.KAVENEGAR_API_KEY;
    await assert.rejects(sendSmsCode("09123456789", "123456"), { code: "SMS_NOT_CONFIGURED" });
    Object.assign(process.env, { NODE_ENV: "development", SMS_DEV_MODE: "true" });
    await sendSmsCode("09123456789", "123456");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ["NODE_ENV", "SMS_PROVIDER", "SMS_DEV_MODE", "KAVENEGAR_API_KEY", "KAVENEGAR_OTP_TEMPLATE"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test("SMS.ir uses authenticated template sending and fails closed on invalid configuration or responses", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, { NODE_ENV: "production", SMS_PROVIDER: "smsir", SMS_DEV_MODE: "false", SMSIR_API_KEY: "private-smsir-key", SMSIR_OTP_TEMPLATE_ID: "42", SMSIR_OTP_PARAMETER: "Code" });
    assert.equal(isSmsDeliveryConfigured(), true);
    let calls = 0;
    globalThis.fetch = (async (url, init) => {
      calls++;
      assert.equal(String(url), "https://api.sms.ir/v1/send/verify");
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("X-API-KEY"), "private-smsir-key");
      assert.deepEqual(JSON.parse(init?.body as string), { mobile: "09123456789", templateId: 42, parameters: [{ name: "Code", value: "123456" }] });
      return Response.json({ status: 1, data: { messageId: 123, cost: 1 } });
    }) as typeof fetch;
    await sendSmsCode("+989123456789", "123456");
    assert.equal(calls, 1);
    for (const payload of [{ status: 119 }, { status: 1 }, { status: 1, data: { messageId: 0 } }, { status: 1, data: { messageId: "123" } }, null]) {
      globalThis.fetch = (async () => Response.json(payload)) as typeof fetch;
      await assert.rejects(sendSmsCode("09123456789", "123456"), { code: "SMS_DELIVERY_FAILED" });
    }
    globalThis.fetch = (async () => Response.json({ status: 1, data: { messageId: 123 } }, { status: 403 })) as typeof fetch;
    await assert.rejects(sendSmsCode("09123456789", "123456"), { code: "SMS_DELIVERY_FAILED" });
    globalThis.fetch = (async () => { throw new Error("private-smsir-key"); }) as typeof fetch;
    await assert.rejects(sendSmsCode("09123456789", "123456"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "SMS_DELIVERY_FAILED");
      return true;
    });
    for (const invalid of ["", "0", "-1", "4.2", "1e2", "9007199254740992"]) {
      process.env.SMSIR_OTP_TEMPLATE_ID = invalid;
      assert.equal(isSmsDeliveryConfigured(), false);
      await assert.rejects(sendSmsCode("09123456789", "123456"), { code: "SMS_NOT_CONFIGURED" });
    }
    process.env.SMSIR_OTP_TEMPLATE_ID = "42";
    process.env.SMSIR_OTP_PARAMETER = "#CODE#";
    assert.equal(isSmsDeliveryConfigured(), false);
    process.env.SMSIR_OTP_PARAMETER = "CODE";
    delete process.env.SMSIR_API_KEY;
    assert.equal(isSmsDeliveryConfigured(), false);
    process.env.SMS_PROVIDER = "typo";
    assert.equal(isSmsDeliveryConfigured(), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ["NODE_ENV", "SMS_PROVIDER", "SMS_DEV_MODE", "SMSIR_API_KEY", "SMSIR_OTP_TEMPLATE_ID", "SMSIR_OTP_PARAMETER"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
