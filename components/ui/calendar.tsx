"use client";

import * as React from "react";
import { DayPicker } from "@daypicker/persian";
import { faIR } from "@daypicker/persian";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={faIR}
      dir="rtl"
      numerals="arabext"
      className={cn("mx-auto w-fit rounded-xl border border-border bg-card p-3", className)}
      style={{
        "--rdp-accent-color": "var(--primary)",
        "--rdp-accent-background-color": "var(--muted)",
        "--rdp-day_button-border-radius": "var(--radius-md)",
        "--rdp-day-height": "2.5rem",
        "--rdp-day-width": "2.5rem",
        "--rdp-day_button-height": "2.35rem",
        "--rdp-day_button-width": "2.35rem",
      } as React.CSSProperties}
      {...props}
    />
  );
}
