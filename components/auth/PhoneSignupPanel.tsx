"use client";

import { useEffect, useRef, useState } from "react";
import { AuthInput } from "./AuthInput";
import { AuthButton } from "./AuthButton";
import { AuthAlert } from "./AuthAlert";
import { SmsOtpPanel } from "./SmsOtpPanel";
import { SignupPasswordFields } from "./SignupPasswordFields";
import { iranianPhoneSchema, phoneSignupSchema } from "@/lib/auth/phone";

export function PhoneSignupPanel({ onRegistered }: { onRegistered: () => void }) {
  const [otpRequired, setOtpRequired] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const validPhone = iranianPhoneSchema.safeParse(phone);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/options", { signal: controller.signal }).then(async (response) => {
      const options = await response.json();
      if (!response.ok || typeof options.signupOtp !== "boolean") throw new Error("options");
      setOtpRequired(options.signupOtp);
    }).catch(() => { if (!controller.signal.aborted) setError("دریافت تنظیمات ثبت‌نام ممکن نشد؛ صفحه را دوباره باز کنید"); });
    return () => controller.abort();
  }, []);

  async function submit() {
    if (pending.current || otpRequired !== false) return;
    const parsed = token ? phoneSignupSchema.safeParse({ phone, password, confirmPassword, token }) : validPhone;
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    pending.current = true;
    setBusy(true); setError(null);
    try {
      const response = await fetch(token ? "/api/auth/signup" : "/api/auth/signup/phone", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { phone, password, confirmPassword, token } : { phone }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "ثبت‌نام ممکن نشد");
        if (payload.code === "INVALID_SIGNUP_TOKEN") setToken(null);
        return;
      }
      if (token) onRegistered();
      else { setPhone(payload.phone); setToken(payload.token); }
    } catch { setError("ارتباط با سرور برقرار نشد"); }
    finally { pending.current = false; setBusy(false); }
  }

  if (otpRequired === true) return <SmsOtpPanel purpose="signup" onVerified={onRegistered} />;
  return <form className="space-y-5" dir="rtl" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <h2 className="text-center text-base font-medium text-white/90">{token ? "رمز عبور حساب خود را تعیین کنید" : "شماره موبایل خود را وارد کنید"}</h2>
    {token ? <>
      <p className="text-center text-sm text-white/60" dir="ltr">{phone}</p>
      <SignupPasswordFields password={password} confirmPassword={confirmPassword} onPasswordChange={setPassword} onConfirmChange={setConfirmPassword} disabled={busy} />
      <button type="button" disabled={busy} className="text-sm text-emerald-200" onClick={() => { setToken(null); setError(null); }}>بازگشت و اصلاح شماره</button>
    </> : <AuthInput id="signup-phone" label="شماره موبایل" type="tel" autoComplete="tel" inputMode="tel" dir="ltr" placeholder="09123456789"
      value={phone} onChange={(event) => { setPhone(event.target.value); setError(null); }} disabled={busy || otpRequired === null} maxLength={40} required
      error={phone && !validPhone.success ? validPhone.error.issues[0].message : undefined} />}
    {error ? <AuthAlert>{error}</AuthAlert> : null}
    <AuthButton type="submit" loading={busy} disabled={otpRequired === null || !validPhone.success || Boolean(token && !phoneSignupSchema.safeParse({ phone, password, confirmPassword, token }).success)}>
      {otpRequired === null ? "در حال آماده‌سازی..." : token ? "ساخت حساب" : "ادامه"}
    </AuthButton>
  </form>;
}
