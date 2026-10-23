import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { iranianPhoneSchema, phoneSignupSchema, smsVerifySchema, isSignupOtpEnabled } from "./phone";
import { signupPasswordSchema } from "@/lib/validations/auth";
import { createSignupToken, verifySignupToken } from "./signup-token";
import { verifyJwt } from "@/lib/jwt";

test("Iranian phone formats and digits share one canonical key", () => {
  for (const phone of ["09123456789", "+989123456789", "00989123456789", "۰۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩", "+۹۸ (۹۱۲) ۳۴۵-۶۷۸۹", "0098 912.345.6789"]) {
    assert.equal(iranianPhoneSchema.parse(phone), "+989123456789");
  }
  for (const phone of ["", "02112345678", "08123456789", "+979123456789", "0912345678", "091234567890", "09abcdefghj", "++989123456789", "0912/3456789", "9".repeat(41)]) {
    assert.equal(iranianPhoneSchema.safeParse(phone).success, false, phone);
  }
});

test("signup validates password strength and confirmation on both API paths", () => {
  for (const password of ["short1", "abcdefgh", "12345678", "Password123!", "Qwerty123", "Admin1234", "abc123456", "a1" + "ش".repeat(36)]) {
    assert.equal(signupPasswordSchema.safeParse(password).success, false, password);
  }
  const input = { phone: "09123456789", password: "MyBookShelf482!", confirmPassword: "MyBookShelf482!", token: "ticket" };
  assert.equal(phoneSignupSchema.safeParse(input).success, true);
  assert.equal(phoneSignupSchema.safeParse({ ...input, confirmPassword: "different" }).success, false);
  assert.equal(phoneSignupSchema.safeParse({ ...input, token: undefined }).success, false);
  assert.equal(smsVerifySchema.safeParse({ ...input, code: "123456", purpose: "signup" }).success, true);
  assert.equal(smsVerifySchema.safeParse({ ...input, code: "123456", purpose: "signup", confirmPassword: undefined }).success, false);
});

test("signup ticket is time-limited, phone-bound, signed and cannot become a session", () => {
  const previous = process.env.JWT_SECRET;
  const previousFlag = process.env.SIGNUP_OTP_ENABLED;
  try {
    process.env.JWT_SECRET = "signup-test-secret-".repeat(3);
    delete process.env.SIGNUP_OTP_ENABLED;
    assert.equal(isSignupOtpEnabled(), false);
    process.env.SIGNUP_OTP_ENABLED = "true";
    assert.equal(isSignupOtpEnabled(), true);
    const phone = "+989123456789";
    const token = createSignupToken(phone);
    assert.equal(verifySignupToken(token, phone), true);
    assert.equal(verifySignupToken(token, "+989123456780"), false);
    assert.equal(verifySignupToken(token + "tampered", phone), false);
    assert.equal(verifyJwt(token), null);
    for (const payload of [
      { phone, purpose: "phone_signup", exp: Math.floor(Date.now() / 1000) - 1 },
      { phone, purpose: "phone_signup" },
      { phone, purpose: "password_reset", exp: Math.floor(Date.now() / 1000) + 100 },
    ]) assert.equal(verifySignupToken(jwt.sign(payload, process.env.JWT_SECRET, { audience: "phone-signup" }), phone), false);
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous;
    if (previousFlag === undefined) delete process.env.SIGNUP_OTP_ENABLED; else process.env.SIGNUP_OTP_ENABLED = previousFlag;
  }
});
