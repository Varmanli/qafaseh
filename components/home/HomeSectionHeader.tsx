import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function HomeSectionHeader({
  icon: Icon,
  eyebrow,
  title,
  href,
  linkLabel = "مشاهده همه",
  compact = false,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  compact?: boolean;
}) {
  return (
    <div
      dir="rtl"
      className={compact ? "flex items-center justify-between gap-3 py-2 sm:mb-4" : "flex items-center justify-between gap-4 py-5 sm:mb-6"}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={compact ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary sm:h-10 sm:w-10" : "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary"}>
          <Icon className={compact ? "h-4 w-4 sm:h-[18px] sm:w-[18px]" : "h-5 w-5"} strokeWidth={2.2} />
        </span>

        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className={compact ? "truncate py-1 text-lg font-black leading-[1.5] tracking-tight text-foreground sm:text-xl" : "truncate py-1 text-xl font-black leading-[1.5] tracking-tight text-foreground sm:text-2xl"}>
            {title}
          </h2>

          {eyebrow ? (
            <span className="hidden shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary sm:inline-flex">
              {eyebrow}
            </span>
          ) : null}
        </div>
      </div>

      {href ? (
        <Link
          href={href}
          className={compact ? "group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-xl border border-primary/15 bg-primary/[0.06] px-2.5 py-1.5 text-[11px] font-extrabold text-primary transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 sm:text-xs" : "group relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.06] px-3.5 py-2 text-xs font-extrabold text-primary transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 sm:text-sm"}
        >
          <span className="relative z-10">{linkLabel}</span>

          <ArrowLeft className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />

          <span className="absolute inset-y-0 left-0 w-0 bg-primary/5 transition-all duration-300 group-hover:w-full" />
        </Link>
      ) : null}
    </div>
  );
}
