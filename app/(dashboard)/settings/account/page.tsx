"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Mail, Palette } from "lucide-react";
import toast from "react-hot-toast";

import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validations/auth";

import { Label } from "@/components/ui/label";
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
import { AuthAlert } from "@/components/auth/AuthAlert";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { SmsOtpPanel } from "@/components/auth/SmsOtpPanel";

export default function AccountSettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (res.ok) {
          setEmail(data.user?.email ?? null);
          setPhone(data.user?.phone ?? null);
        }
      } catch {
        // بی‌صدا
      }
    })();
  }, []);

  const onSubmit = async (values: ChangePasswordInput) => {
    setServerError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error || "تغییر رمز ناموفق بود");
        return;
      }

      toast.success(data.message || "رمز عبور تغییر کرد");
      form.reset();
    } catch {
      setServerError("ارتباط با سرور برقرار نشد");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[32px] border border-border/80 bg-gradient-to-b from-card/80 to-card/50 shadow-xl shadow-black/10">
      {/* اطلاعات حساب */}
      <section className="p-6 sm:p-7">
        <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mail className="h-4 w-4 text-primary" />
          اطلاعات حساب
        </h2>

        <div className="space-y-2">
          <Label>ایمیل</Label>

          <div
            dir="ltr"
            className="flex h-11 items-center rounded-xl border border-input/70 bg-background/40 px-3 text-sm text-muted-foreground"
          >
            {email ?? "—"}
          </div>
        </div>
      </section>

      <section className="p-6 sm:p-7">
        <h2 className="mb-4 font-semibold">ورود با پیامک</h2>
        {phone ? <p className="mb-3 text-sm text-muted-foreground">شماره متصل: <span dir="ltr">{phone}</span></p> : null}
        <div className="rounded-3xl bg-slate-950 p-5"><SmsOtpPanel purpose="link" onVerified={(verifiedPhone) => { setPhone(verifiedPhone); toast.success("شماره به همین حساب متصل شد"); }} /></div>
      </section>

      <div className="mx-6 border-t border-border/70 sm:mx-7" />

      {/* ظاهر */}
      <section className="p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Palette className="h-4 w-4 text-primary" />
            تم سایت
          </h2>

          <ThemeToggle />
        </div>
      </section>

      <div className="mx-6 border-t border-border/70 sm:mx-7" />

      {/* تغییر رمز عبور */}
      <section className="p-6 sm:p-7">
        <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="h-4 w-4 text-primary" />
          تغییر رمز عبور
        </h2>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            {serverError && <AuthAlert>{serverError}</AuthAlert>}

            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رمز عبور فعلی</FormLabel>

                  <FormControl>
                    <PasswordInput
                      autoComplete="current-password"
                      dir="ltr"
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
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

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تکرار رمز عبور جدید</FormLabel>

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

            <Button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 sm:w-auto sm:px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال تغییر...
                </>
              ) : (
                "تغییر رمز عبور"
              )}
            </Button>
          </form>
        </Form>
      </section>
    </div>
  );
}
