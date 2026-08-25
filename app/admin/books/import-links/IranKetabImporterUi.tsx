"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookCheck,
  Check,
  FileSearch,
  History,
  Link2,
  ScanSearch,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const steps = [
  { label: "دریافت اطلاعات", icon: FileSearch },
  { label: "بررسی داده‌ها", icon: ScanSearch },
  { label: "بررسی پدیدآورندگان", icon: Users },
  { label: "تطبیق موجودی", icon: Users },
  { label: "بررسی نسخه‌ها", icon: UploadCloud },
  { label: "آمادگی پیش‌نویس", icon: ShieldCheck },
  { label: "ثبت نهایی", icon: BookCheck },
];
export function ImportStepper({ current }: { current: number }) {
  return (
    <nav
      aria-label="مراحل ورود کتاب"
      className="overflow-x-auto rounded-2xl border bg-card/70 p-2 shadow-sm"
    >
      <ol className="flex min-w-[720px] items-center gap-1">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          const Icon = step.icon;
          return (
            <li
              key={step.label}
              aria-current={active ? "step" : undefined}
              className="flex flex-1 items-center gap-2"
            >
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-colors sm:text-xs",
                  active
                    ? "bg-primary/12 text-primary ring-1 ring-primary/20"
                    : complete
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-lg",
                    active || complete
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                  aria-hidden
                >
                  {complete ? (
                    <Check className="size-4" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </span>
                <span className="truncate">{step.label}</span>
              </div>
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    "h-px w-4 shrink-0",
                    complete ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type WorkflowStat = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
};

export function ImportStats({ stats }: { stats: WorkflowStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border bg-background/70 px-3 py-2">
          <div className="text-[11px] text-muted-foreground">{stat.label}</div>
          <div className={cn(
            "mt-0.5 text-lg font-black tabular-nums",
            stat.tone === "success" && "text-emerald-600 dark:text-emerald-400",
            stat.tone === "warning" && "text-amber-600 dark:text-amber-400",
            stat.tone === "danger" && "text-destructive",
          )}>{typeof stat.value === "number" ? stat.value.toLocaleString("fa-IR") : stat.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ImportStickySummary({
  title,
  status,
  stats,
  action,
  secondary,
  disabledReason,
}: {
  title: string;
  status?: string;
  stats: WorkflowStat[];
  action?: ReactNode;
  secondary?: ReactNode;
  disabledReason?: string;
}) {
  return (
    <section className="sticky top-2 z-30 rounded-2xl border border-primary/20 bg-card/95 p-3 shadow-lg shadow-foreground/[0.06] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:p-4" aria-label="خلاصه و اقدامات فرآیند">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-black sm:text-base">{title}</h2>
          {status ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">{status}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">{secondary}{action}</div>
      </div>
      <ImportStats stats={stats} />
      {disabledReason ? <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">{disabledReason}</p> : null}
    </section>
  );
}

export function InitialGuide() {
  const items = [
    {
      title: "استخراج امن",
      text: "اطلاعات کتاب و نسخه‌ها از صفحه ایران‌کتاب دریافت و اعتبارسنجی می‌شوند.",
      icon: ShieldCheck,
    },
    {
      title: "تطبیق با قفسه",
      text: "کتاب‌ها، نسخه‌ها، نویسندگان، مترجمان و ناشران موجود بررسی می‌شوند.",
      icon: ScanSearch,
    },
    {
      title: "ثبت پس از تأیید",
      text: "هیچ اطلاعاتی پیش از بررسی و تأیید نهایی شما در سایت ثبت نمی‌شود.",
      icon: BookCheck,
    },
  ];
  return (
    <section aria-labelledby="workflow-guide">
      <h2 id="workflow-guide" className="mb-3 text-sm font-black">
        این فرآیند چگونه کار می‌کند؟
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map(({ title, text, icon: Icon }) => (
          <div key={title} className="rounded-2xl border bg-card/45 p-4">
            <Icon className="mb-3 size-5 text-primary" />
            <h3 className="text-sm font-black">{title}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export type RecentImport = {
  id: string;
  sourceUrl: string;
  canonicalSourceUrl: string;
  status: string;
  updatedAt?: string;
  createdAt: string;
  errorCode?: string | null;
};
const statusLabel: Record<string, string> = {
  SUCCESS: "موفق",
  FAILED: "ناموفق",
  READY_TO_COMMIT: "آماده ثبت",
  DRAFT_REVIEW: "در حال بررسی",
  COVER_PREPARATION: "آماده‌سازی کاور",
  PREVIEW_READY: "پیش‌نمایش آماده",
  EXTRACTING: "در حال استخراج",
};
export function RecoverableCard({
  session,
  onContinue,
  onRestart,
}: {
  session: RecentImport;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const progress = Math.max(
    20,
    ([
      "CREATED",
      "EXTRACTING",
      "PREVIEW_READY",
      "DRAFT_REVIEW",
      "COVER_PREPARATION",
      "READY_TO_COMMIT",
      "COMMITTING",
    ].indexOf(session.status) +
      1) *
      14,
  );
  return (
    <Card className="border-primary/25 bg-primary/[0.035]">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <History className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">
              یک فرآیند نیمه‌کاره دارید
            </CardTitle>
            <CardDescription className="mt-1 break-all" dir="ltr">
              {session.canonicalSourceUrl}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-xs">
          <span>
            مرحله فعلی: {statusLabel[session.status] ?? session.status}
          </span>
          <span>
            {session.updatedAt
              ? new Date(session.updatedAt).toLocaleString("fa-IR")
              : ""}
          </span>
        </div>
        <Progress value={Math.min(progress, 95)} aria-label="پیشرفت فرآیند" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onContinue}>ادامه فرایند</Button>
          <Button variant="ghost" onClick={onRestart}>
            شروع ورود جدید
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
export function RecentHistory({ sessions }: { sessions: RecentImport[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">ورودهای اخیر</CardTitle>
          <CardDescription>آخرین فرآیندهای ثبت‌شده</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/books/import-history">مشاهده همه تاریخچه</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.length ? (
          <div className="grid gap-2">
            {sessions.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/admin/books/import-history/${item.id}`}
                className="grid min-w-0 gap-1 rounded-xl border p-3 transition-colors hover:bg-muted/50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
              >
                <span className="truncate text-sm font-bold" dir="ltr">
                  {String(
                    item.canonicalSourceUrl,
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-bold",
                    item.status === "SUCCESS"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : item.status === "FAILED"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {statusLabel[item.status] ?? item.status}
                </span>
                <time className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString("fa-IR")}
                </time>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-5 text-center text-sm text-muted-foreground">
            هنوز سابقه‌ای ثبت نشده است.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
