"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SmsOtpPanel } from "@/components/auth/SmsOtpPanel";

export default function ForgotPasswordPage() {
  const router = useRouter();

  return (
    <AuthCard footer={
      <Link href="/auth/login" className="font-semibold text-emerald-200 hover:text-emerald-100">
        بازگشت به ورود
      </Link>
    }>
      <h1 className="sr-only">بازیابی رمز عبور</h1>
      <SmsOtpPanel purpose="recovery" onVerified={(_phone, resetToken) => {
        if (resetToken) router.push(`/auth/reset-password?token=${encodeURIComponent(resetToken)}`);
      }} />
    </AuthCard>
  );
}
