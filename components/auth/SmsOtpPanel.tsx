"use client";

import { useEffect, useState } from "react";
import { AuthInput } from "./AuthInput";
import { AuthButton } from "./AuthButton";
import { AuthCodeInput } from "./AuthCodeInput";
import { AuthAlert } from "./AuthAlert";
import { normalizeIranianPhone, type SmsPurpose } from "@/lib/auth/phone";
import { signupPasswordSchema } from "@/lib/validations/auth";
import { SignupPasswordFields } from "./SignupPasswordFields";

export function SmsOtpPanel({ purpose = "login", onVerified }: { purpose?: SmsPurpose; onVerified: (phone: string, resetToken?: string) => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/options", { signal: controller.signal }).then(async (response) => {
      setAvailable(response.ok && (await response.json()).sms === true);
    }).catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (busy || cooldown > 0 || !available) return;
    const normalized = normalizeIranianPhone(phone);
    if (!normalized) { setError("شماره موبایل ایران را وارد کنید"); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/auth/sms/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: normalized, purpose }) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "ارسال کد ممکن نشد"); return; }
      setPhone(normalized); setSent(true); setCode(""); setCooldown(60); setDevCode(payload.devCode ?? null);
    } catch { setError("ارتباط با سرور برقرار نشد"); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    if (busy || code.length !== 6) return;
    if (purpose === "signup") {
      const parsed = signupPasswordSchema.safeParse(password);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      if (password !== confirmPassword) { setError("رمز عبور و تکرار آن یکسان نیستند"); return; }
    }
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/auth/sms/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code, purpose, rememberMe: true, ...(purpose === "signup" ? { password, confirmPassword } : {}) }) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "کد نامعتبر است"); return; }
      if (purpose === "recovery" && (typeof payload.resetToken !== "string" || !/^[a-f0-9]{64}$/.test(payload.resetToken))) { setError("تأیید بازیابی ممکن نشد"); return; }
      onVerified(phone, payload.resetToken);
      setSent(false); setCode(""); setPassword(""); setConfirmPassword(""); setDevCode(null);
    } catch { setError("ارتباط با سرور برقرار نشد"); }
    finally { setBusy(false); }
  }

  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void (sent ? verifyCode() : sendCode()); }}>
    <AuthInput id={`sms-phone-${purpose}`} label="شماره موبایل" type="tel" autoComplete="tel" inputMode="tel" dir="ltr" placeholder="09123456789" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy || sent} />
    {sent ? <div className="space-y-3"><p className="text-center text-sm text-white/80">کد تأیید</p><AuthCodeInput value={code} onChange={setCode} disabled={busy} /><p className="text-center text-xs text-white/50">اعتبار کد: ۵ دقیقه</p></div> : null}
    {sent && purpose === "signup" ? <SignupPasswordFields password={password} confirmPassword={confirmPassword} onPasswordChange={setPassword} onConfirmChange={setConfirmPassword} disabled={busy} /> : null}
    {available === false ? <AuthAlert>ارسال کد فعلاً در دسترس نیست.</AuthAlert> : null}
    {error ? <AuthAlert>{error}</AuthAlert> : null}
    {devCode ? <AuthAlert variant="success">حالت آزمایشی؛ پیامکی ارسال نشده است. کد آزمایش: {devCode}</AuthAlert> : null}
    <AuthButton type="submit" loading={busy} disabled={!available || (sent && code.length !== 6)}>{available === null ? "در حال آماده‌سازی..." : sent ? (purpose === "link" ? "تأیید و اتصال شماره" : purpose === "recovery" ? "تأیید و انتخاب رمز جدید" : purpose === "signup" ? "تأیید و ساخت حساب" : "تأیید و ورود") : purpose === "recovery" ? "دریافت کد بازیابی" : "دریافت کد پیامکی"}</AuthButton>
    {sent ? <div className="flex items-center justify-between gap-3 text-sm text-emerald-200">
      <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); setError(null); setDevCode(null); }}>تغییر شماره</button>
      <button type="button" disabled={busy || cooldown > 0} onClick={() => void sendCode()} className="disabled:text-white/40">{cooldown ? `ارسال دوباره (${cooldown})` : "ارسال دوباره کد"}</button>
    </div> : null}
  </form>;
}
