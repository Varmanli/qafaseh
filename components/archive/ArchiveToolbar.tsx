"use client";

import { forwardRef } from "react";
import type { ComponentProps, FormEvent, ReactNode } from "react";

import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ArchiveToolbar({
  children,
  below,
  label,
}: {
  children: ReactNode;
  below?: ReactNode;
  label: string;
}) {
  return (
    <section
      className="relative z-20 mx-auto w-full"
      dir="rtl"
      aria-label={label}
    >
      <div className="flex min-w-0 items-center gap-2.5">{children}</div>

      {below ? <div className="mt-3">{below}</div> : null}
    </section>
  );
}

export function ArchiveSearch({
  value,
  onChange,
  onClear,
  placeholder,
  ariaLabel,
  name,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder: string;
  ariaLabel: string;
  name?: string;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const input = (
    <div className="group relative h-[52px] min-w-0 flex-1">
      <Search
        aria-hidden="true"
        className="
          pointer-events-none
          absolute right-4 top-1/2 z-10
          size-[18px]
          -translate-y-1/2
          text-muted-foreground/80
          transition-colors duration-200
          group-focus-within:text-primary
        "
      />

      <input
        type="search"
        dir="rtl"
        name={name}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="
          h-full w-full
          rounded-[14px]
          border border-border/80
          bg-card
          pr-11 pl-11
          text-right text-[14px] font-medium
          text-foreground
          outline-none

          shadow-[0_1px_2px_rgba(0,0,0,0.03)]

          transition-[border-color,box-shadow,background-color]
          duration-200

          placeholder:text-muted-foreground/70

          hover:border-foreground/15

          focus:border-primary/45
          focus:bg-background
          focus:ring-[3px]
          focus:ring-primary/[0.08]

          [unicode-bidi:plaintext]
        "
      />

      {value ? (
        <button
          type="button"
          onClick={onClear ?? (() => onChange(""))}
          aria-label="پاک کردن جست‌وجو"
          className="
            absolute left-3 top-1/2
            flex size-7
            -translate-y-1/2
            items-center justify-center
            rounded-lg
            text-muted-foreground/70

            transition-colors duration-200

            hover:bg-muted
            hover:text-foreground

            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-primary/20
          "
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );

  if (!onSubmit) {
    return input;
  }

  return (
    <form className="min-w-0 flex-1" role="search" onSubmit={onSubmit}>
      {input}
    </form>
  );
}

export const ArchiveFilterButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<typeof Button> & {
    activeCount?: number;
    label: string;
  }
>(function ArchiveFilterButton(
  { activeCount = 0, label, className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      aria-label={label}
      {...props}
      className={`
        relative
        size-[52px]
        shrink-0

        rounded-[14px]
        border border-border/80
        bg-card
        p-0

        text-muted-foreground

        shadow-[0_1px_2px_rgba(0,0,0,0.03)]

        transition-[border-color,background-color,color,box-shadow,transform]
        duration-200

        hover:border-foreground/15
        hover:bg-muted/60
        hover:text-foreground

        active:scale-[0.97]

        focus-visible:border-primary/40
        focus-visible:ring-[3px]
        focus-visible:ring-primary/[0.08]

        ${className ?? ""}
      `}
    >
      <SlidersHorizontal aria-hidden="true" className="size-[18px]" />

      {activeCount > 0 ? (
        <span
          className="
            absolute -right-1.5 -top-1.5
            flex h-[19px] min-w-[19px]
            items-center justify-center

            rounded-full
            border-2 border-background
            bg-primary
            px-1

            text-[9px] font-bold
            leading-none
            tabular-nums
            text-primary-foreground

            shadow-sm
          "
        >
          {activeCount.toLocaleString("fa-IR")}
        </span>
      ) : null}
    </Button>
  );
});
