"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/auth/phone";

export function AuthCodeInput({
  value,
  onChange,
  disabled = false,
  length = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  length?: number;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(
    () => Array.from({ length }, (_, index) => value[index] ?? ""),
    [value, length]
  );

  useEffect(() => {
    const nextIndex = digits.findIndex((digit) => digit === "");
    const targetIndex = nextIndex === -1 ? length - 1 : nextIndex;
    refs.current[targetIndex]?.focus();
  }, [digits, length]);

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2" dir="ltr">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          inputMode="numeric"
          aria-label={`رقم ${index + 1} از ${length}`}
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => {
            const input = normalizeDigits(event.target.value).replace(/\D/g, "");
            if (input.length > 1) { onChange(input.slice(0, length)); return; }
            const next = input;
            const updated = digits.slice();
            updated[index] = next;
            onChange(updated.join(""));
            if (next) refs.current[index + 1]?.focus();
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = normalizeDigits(event.clipboardData.getData("text")).replace(/\D/g, "");
            if (pasted) onChange(pasted.slice(0, length));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          className={cn(
            "h-12 w-9 rounded-2xl border border-white/10 bg-black/20 text-center text-xl font-black text-white outline-none transition focus:border-emerald-200/50 focus:ring-2 focus:ring-emerald-200/15 sm:h-16 sm:w-14",
            disabled && "cursor-not-allowed opacity-60"
          )}
        />
      ))}
    </div>
  );
}
