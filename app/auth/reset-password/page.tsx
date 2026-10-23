"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { AuthAlert } from "@/components/auth/AuthAlert";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  const passwordValue = form.watch("password");

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: values.token, password: values.password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error || "بازنشانی رمز ناموفق بود");
        return;
      }

      toast.success("رمز عبور تغییر کرد");
      router.push("/auth/login?reset=1");
    } catch {
      setServerError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  // بدون توکن، فرم بی‌معنی است
  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <AuthHeading title="لینک نامعتبر" />
        <AuthAlert>
          لینک بازنشانی نامعتبر است یا توکن آن وجود ندارد. لطفاً دوباره درخواست
          بازیابی رمز بدهید.
        </AuthAlert>
        <p className="mt-6 text-center text-sm">
          <Link
            href="/auth/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            بازیابی با شماره موبایل یا ایمیل
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <AuthHeading
        title="رمز عبور جدید"
        subtitle="یک رمز عبور تازه و امن برای حسابت انتخاب کن"
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          {serverError && <AuthAlert>{serverError}</AuthAlert>}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>رمز عبور جدید</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    dir="ltr"
                    placeholder="حداقل ۸ کاراکتر شامل حرف و عدد"
                    {...field}
                  />
                </FormControl>
                <PasswordStrength value={passwordValue} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>تکرار رمز عبور</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    dir="ltr"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ذخیره...
              </>
            ) : (
              "ذخیره‌ی رمز جدید"
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/auth/login"
          className="font-medium text-primary hover:underline"
        >
          بازگشت به ورود
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
