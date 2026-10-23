"use client";

import { useEffect, useMemo, useState } from "react";
import { MailCheck } from "lucide-react";
import toast from "react-hot-toast";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthButton } from "@/components/auth/AuthButton";
import { AuthCodeInput } from "@/components/auth/AuthCodeInput";

type Purpose = "email_verification" | "login" | "password_reset";

export function VerificationCodePanel({
  email,
  purpose,
  title,
  subtitle,
  submitLabel,
  successMessage,
  onVerified,
  initialDevCode,
}: {
  email: string;
  purpose: Purpose;
  title: string;
  subtitle: string;
  submitLabel: string;
  successMessage: string;
  onVerified: (payload?: { resetToken?: string }) => void;
  initialDevCode?: string | null;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [devCode, setDevCode] = useState<string | null>(initialDevCode ?? null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((current) => current - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const canSubmit = code.length === 6 && !submitting;

  const cooldownLabel = useMemo(
    () => `ارسال دوباره کد (${cooldown.toLocaleString("fa-IR")})`,
    [cooldown]
  );

  async function resendCode() {
    if (cooldown > 0) return;
    setError(null);
    setResending(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ارسال دوباره کد ناموفق بود.");
        return;
      }

      setCooldown(60);
      setCode("");
      setDevCode(data.devCode ?? null);
      toast.success("کد جدید ارسال شد.");
    } catch {
      setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setResending(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, purpose }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "کد واردشده نامعتبر است.");
        return;
      }

      toast.success(successMessage);
      onVerified({ resetToken: data.resetToken });
    } catch {
      setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-3xl border border-emerald-200/12 bg-emerald-200/10 text-emerald-100">
          <MailCheck className="h-7 w-7" />
        </span>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">{title}</h2>
          <p className="text-sm leading-7 text-white/60">{subtitle}</p>
          <p dir="ltr" className="text-sm font-medium text-emerald-200/85">
            {email}
          </p>
        </div>
      </div>

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <div className="space-y-3">
        <label className="block text-center text-sm font-semibold text-white/82">
          کد تایید
        </label>
        <AuthCodeInput value={code} onChange={setCode} disabled={submitting} />
        <p className="text-center text-xs text-white/45">کد تا ۱۰ دقیقه معتبر است</p>
      </div>

      {devCode ? <AuthAlert variant="success">کد توسعه: {devCode}</AuthAlert> : null}

      <AuthButton
        type="button"
        loading={submitting}
        disabled={!canSubmit}
        onClick={verifyCode}
      >
        {submitting ? "در حال بررسی..." : submitLabel}
      </AuthButton>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-white/45">کد را دریافت نکردی؟</span>
        <button
          type="button"
          disabled={cooldown > 0 || resending}
          onClick={resendCode}
          className="font-semibold text-emerald-200 transition-colors hover:text-emerald-100 disabled:cursor-not-allowed disabled:text-white/35"
        >
          {cooldown > 0
            ? cooldownLabel
            : resending
              ? "در حال ارسال..."
              : "ارسال دوباره کد"}
        </button>
      </div>
    </div>
  );
}
