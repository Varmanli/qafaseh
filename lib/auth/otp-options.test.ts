import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/auth/options/route";

test("runtime OTP options hide missing providers and never return credentials", async () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production", SMS_PROVIDER: "kavenegar", SMS_OTP_ENABLED: "true", SMS_DEV_MODE: "true", NEXT_PUBLIC_EMAIL_OTP_ENABLED: "true" });
    for (const key of ["KAVENEGAR_API_KEY", "KAVENEGAR_OTP_TEMPLATE", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM"]) delete process.env[key];
    assert.deepEqual(await GET().json(), { ok: true, sms: false, email: false });
    Object.assign(process.env, { KAVENEGAR_API_KEY: "private-sms-key", KAVENEGAR_OTP_TEMPLATE: "approvedTemplate", SMTP_HOST: "smtp.example.test", SMTP_PORT: "465", SMTP_USER: "private-user", SMTP_PASSWORD: "private-password", MAIL_FROM: "noreply@example.test" });
    const response = GET();
    const payload = await response.json();
    assert.deepEqual(payload, { ok: true, sms: true, email: true });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.doesNotMatch(JSON.stringify(payload), /private-|smtp|Template/);
    process.env.SMS_PROVIDER = "smsir";
    delete process.env.SMSIR_API_KEY;
    delete process.env.SMSIR_OTP_TEMPLATE_ID;
    assert.deepEqual(await GET().json(), { ok: true, sms: false, email: true });
    Object.assign(process.env, { SMSIR_API_KEY: "private-smsir-key", SMSIR_OTP_TEMPLATE_ID: "42", SMSIR_OTP_PARAMETER: "CODE" });
    assert.deepEqual(await GET().json(), { ok: true, sms: true, email: true });
    process.env.SMS_OTP_ENABLED = "false";
    process.env.NEXT_PUBLIC_EMAIL_OTP_ENABLED = "false";
    assert.deepEqual(await GET().json(), { ok: true, sms: false, email: false });
  } finally {
    for (const key of ["NODE_ENV", "SMS_PROVIDER", "SMSIR_API_KEY", "SMSIR_OTP_TEMPLATE_ID", "SMSIR_OTP_PARAMETER", "SMS_OTP_ENABLED", "SMS_DEV_MODE", "NEXT_PUBLIC_EMAIL_OTP_ENABLED", "KAVENEGAR_API_KEY", "KAVENEGAR_OTP_TEMPLATE", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
