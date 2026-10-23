"use client";

import { AuthInput } from "./AuthInput";
import { signupPasswordSchema } from "@/lib/validations/auth";

export function SignupPasswordFields({ password, confirmPassword, onPasswordChange, onConfirmChange, disabled }: {
  password: string; confirmPassword: string; onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void; disabled: boolean;
}) {
  const validation = signupPasswordSchema.safeParse(password);
  return <div className="space-y-5" aria-live="polite">
    <AuthInput id="signup-password" label="رمز عبور" type="password" autoComplete="new-password" dir="ltr"
      placeholder="حداقل ۸ کاراکتر، شامل حرف و عدد" value={password}
      onChange={(event) => onPasswordChange(event.target.value)} disabled={disabled} maxLength={72} required
      error={password && !validation.success ? validation.error.issues[0].message : undefined}
      hint={password && validation.success ? "رمز عبور شرایط لازم را دارد" : "حداقل ۸ کاراکتر، شامل حرف و عدد؛ از رمزهای رایج استفاده نکنید"} />
    <AuthInput id="signup-confirm-password" label="تکرار رمز عبور" type="password" autoComplete="new-password" dir="ltr"
      value={confirmPassword} onChange={(event) => onConfirmChange(event.target.value)} disabled={disabled} maxLength={72} required
      error={confirmPassword && password !== confirmPassword ? "رمز عبور و تکرار آن یکسان نیستند" : undefined}
      hint={confirmPassword && password === confirmPassword ? "تکرار رمز عبور مطابقت دارد" : undefined} />
  </div>;
}
