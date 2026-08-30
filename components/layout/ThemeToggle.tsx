"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

import { cn } from "@/lib/utils";

export default function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      disabled={!mounted}
      aria-label={isDark ? "فعال کردن حالت روشن" : "فعال کردن حالت تیره"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex min-w-[9rem] items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/50 px-3.5 py-2.5 text-sm transition-colors",
        "hover:border-primary/25 hover:bg-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        {mounted && isDark ? (
          <Moon className="h-4 w-4 text-primary" />
        ) : (
          <Sun className="h-4 w-4 text-primary" />
        )}

        <span className="font-medium text-foreground">
          {mounted ? (isDark ? "تم تیره" : "تم روشن") : "تم سایت"}
        </span>
      </span>

      <span
        className={cn(
          "relative h-6 w-11 rounded-full border border-border transition-colors",
          mounted && isDark ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background shadow-sm transition-transform",
            mounted && isDark ? "translate-x-0.5" : "translate-x-[1.35rem]",
          )}
        />
      </span>
    </button>
  );
}
