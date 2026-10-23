"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { SmsOtpPanel } from "@/components/auth/SmsOtpPanel";

export default function SignupPage() {
  const router = useRouter();
  return <AuthCard footer={<p>حساب دارید؟ <Link href="/auth/login" className="font-semibold text-emerald-200 hover:text-emerald-100">ورود</Link></p>}>
    <h1 className="sr-only">ساخت حساب</h1>
    <GoogleAuthButton />
    <div className="my-6 flex items-center gap-4" aria-hidden="true"><span className="h-px flex-1 bg-white/10" /><span className="text-xs text-white/35">یا</span><span className="h-px flex-1 bg-white/10" /></div>
    <SmsOtpPanel purpose="signup" onVerified={() => { router.push("/dashboard"); router.refresh(); }} />
  </AuthCard>;
}
