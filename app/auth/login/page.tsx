"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthButton } from "@/components/auth/AuthButton";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { getSafeRedirectPath } from "@/lib/auth/routes";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectPath(searchParams.get("redirect"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", rememberMe: true },
    mode: "onTouched",
  });

  useEffect(() => {
    if (searchParams.get("google_error")) toast.error("ورود با گوگل ناموفق بود.");
    else if (searchParams.get("reset")) toast.success("رمز عبور تغییر کرد.");
    else if (searchParams.get("verified")) toast.success("ایمیل تأیید شد.");
  }, [searchParams]);

  async function submit(values: LoginInput) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "ورود ناموفق بود."); return; }
      router.push(redirectTo);
      router.refresh();
    } catch { setError("ارتباط با سرور برقرار نشد."); }
    finally { setBusy(false); }
  }

  return <AuthCard footer={<div className="flex flex-wrap items-center justify-between gap-3 text-xs">
    <p>حساب ندارید؟ <Link href="/auth/signup" className="font-semibold text-emerald-200 hover:text-emerald-100">ثبت‌نام</Link></p>
    <Link href="/auth/forgot-password" className="text-white/55 hover:text-emerald-200">فراموشی رمز عبور</Link>
  </div>}>
    <h1 className="sr-only">ورود به قفسه</h1>
    <GoogleAuthButton redirectTo={redirectTo} />
    <div className="my-6 flex items-center gap-4" aria-hidden="true"><span className="h-px flex-1 bg-white/10" /><span className="text-xs text-white/35">یا</span><span className="h-px flex-1 bg-white/10" /></div>
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <AuthInput id="identifier" label="شماره موبایل یا ایمیل" placeholder="09… / you@example.com" autoComplete="username" dir="ltr" disabled={busy} error={errors.identifier?.message} {...register("identifier")} />
      <AuthInput id="password" label="رمز عبور" type="password" autoComplete="current-password" dir="ltr" disabled={busy} error={errors.password?.message} {...register("password")} />
      <AuthButton type="submit" loading={busy}>ورود</AuthButton>
    </form>
  </AuthCard>;
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
