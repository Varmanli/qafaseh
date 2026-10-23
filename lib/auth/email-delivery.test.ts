import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";

test("transactional SMTP requires encryption, disables tracking and reports failures", async () => {
  const previous = { ...process.env };
  const originalCreateTransport = nodemailer.createTransport;
  const originalConsoleError = console.error;
  let options: Record<string, unknown> = {};
  let sent: Record<string, unknown> = {};
  let fail = false;
  const logs: unknown[][] = [];
  try {
    Object.assign(process.env, { SMTP_HOST: "smtp.example.test", SMTP_PORT: "2525", SMTP_USER: "generated-user", SMTP_PASSWORD: "test-secret", MAIL_FROM: "noreply@example.test", EMAIL_DEV_MODE: "false", EMAIL_MODE: "smtp" });
    nodemailer.createTransport = ((input: Record<string, unknown>) => {
      options = input;
      return { sendMail: async (message: Record<string, unknown>) => {
        sent = message;
        if (fail) throw Object.assign(new Error("test-secret private details"), { code: "ETIMEDOUT" });
        return { messageId: "test-id" };
      } };
    }) as unknown as typeof nodemailer.createTransport;
    console.error = (...args) => { logs.push(args); };
    const { sendEmail, isEmailDeliveryConfigured } = await import("@/lib/email");
    assert.equal(isEmailDeliveryConfigured(), true);
    const message = { to: "recipient@example.test", subject: "Test OTP", text: "123456", html: "<p>123456</p>" };
    assert.deepEqual(await sendEmail(message), { ok: true, messageId: "test-id" });
    assert.equal(options.requireTLS, true);
    assert.equal(options.secure, false);
    assert.deepEqual(sent.headers, { IsTransactional: "True", trackclicks: "false", trackopens: "false" });
    fail = true;
    assert.deepEqual(await sendEmail(message), { ok: false, reason: "delivery" });
    delete process.env.SMTP_PASSWORD;
    assert.equal(isEmailDeliveryConfigured(), false);
    assert.deepEqual(await sendEmail(message), { ok: false, reason: "configuration" });
    assert.doesNotMatch(JSON.stringify(logs), /test-secret|123456|recipient@example/);
  } finally {
    nodemailer.createTransport = originalCreateTransport;
    console.error = originalConsoleError;
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "EMAIL_DEV_MODE", "EMAIL_MODE"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
