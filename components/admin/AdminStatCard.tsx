import Link from "next/link";
import { ArrowUpLeft, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export default function AdminStatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
  hint?: string;
  tone?: "default" | "primary" | "warning";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary ring-primary/20"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-500 ring-amber-500/20"
        : "bg-muted text-muted-foreground ring-border";
  const accent = tone === "warning" ? "#f59e0b" : tone === "primary" ? "#7de2b4" : "#8aa99b";

  const body = (
    <div className="group relative flex items-start justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#101c17] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-0.5 hover:border-white/20">
      <div className="absolute inset-x-8 top-0 h-0.5 opacity-75" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="min-w-0">
        <p className="text-xs font-bold text-white/55">{label}</p>
        <p className="mt-1 text-2xl font-black tabular-nums text-white">
          {typeof value === "number" ? value.toLocaleString("fa-IR") : value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] text-white/40">{hint}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
          toneClass
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="group relative block">
      {body}
      <ArrowUpLeft className="absolute bottom-3 left-3 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
