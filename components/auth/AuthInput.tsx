"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AuthInputProps extends React.ComponentProps<"input"> {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  wrapperClassName?: string;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      action,
      className,
      type,
      wrapperClassName,
      id,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = React.useState(false);
    const resolvedType = type === "password" ? (visible ? "text" : "password") : type;

    return (
      <div className={cn("space-y-2", wrapperClassName)}>
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={id}
            className="text-sm font-medium text-white/80"
          >
            {label}
          </label>
          {action}
        </div>

        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/35">
              {icon}
            </span>
          ) : null}

          <Input
            ref={ref}
            id={id}
            type={resolvedType}
            aria-invalid={error ? "true" : "false"}
            className={cn(
              "h-11 rounded-xl border-white/10 bg-black/15 text-white placeholder:text-white/30 hover:border-white/20 focus-visible:border-emerald-200/50 focus-visible:ring-emerald-200/15",
              icon ? "pr-12" : "pr-4",
              type === "password" ? "pl-12" : "pl-4",
              className
            )}
            {...props}
          />

          {type === "password" ? (
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
              className="absolute inset-y-0 left-0 flex w-12 items-center justify-center text-white/40 transition-colors hover:text-white/70"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm leading-6 text-rose-300">{error}</p>
        ) : hint ? (
          <p className="text-xs leading-6 text-white/48">{hint}</p>
        ) : null}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
