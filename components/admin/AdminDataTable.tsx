import { type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * سیستم جدول جزیره‌ای پنل مدیریت
 *
 * طراحی:
 * - هر سلول یک جزیره مستقل است.
 * - ردیف‌ها فاصله عمودی دارند.
 * - ستون اول به صورت خودکار برجسته‌تر نمایش داده می‌شود.
 * - مناسب صفحات کاربران، کتاب‌ها، دسته‌بندی‌ها، نویسنده‌ها، ناشرها، مترجم‌ها و ...
 */

type Align = "start" | "center" | "end";

const alignClass: Record<Align, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

const contentAlignClass: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
};

export interface AdminColumn {
  key: string;
  label: ReactNode;
  className?: string;
  align?: Align;
}

// ---------------- نوار ابزار بالای جدول ----------------
export function AdminDataTableToolbar({
  title,
  subtitle,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  const hasTitle = !!title;
  if (!hasTitle && !children) return null;

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4",
        hasTitle && "lg:flex-row lg:items-end lg:justify-between",
      )}
    >
      {hasTitle ? (
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}

      {children ? (
        // نوار کنترل تمام‌عرض؛ جست‌وجو بیشترین فضا را می‌گیرد و فیلتر/دکمه کنارش
        // می‌نشینند. در موبایل تمیز روی هم می‌چینند.
        <div
          className={cn(
            "flex w-full flex-col gap-3 sm:flex-row sm:items-center",
            hasTitle && "lg:w-auto",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------------- جست‌وجو ----------------
export function AdminDataTableSearch({
  value,
  onChange,
  placeholder = "جست‌وجو...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("group relative w-full min-w-0 flex-1 sm:min-w-[280px]", className)}>
      <span className="pointer-events-none absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-[#7de2b4]/20 bg-[#7de2b4]/10 text-[#7de2b4] transition-colors group-focus-within:bg-[#7de2b4]/15">
        <Search className="h-4 w-4" />
      </span>

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#101c17] pr-14 pl-4 text-sm font-bold text-white shadow-[0_14px_38px_rgba(0,0,0,0.16)] outline-none transition-all placeholder:text-white/45 hover:border-[#7de2b4]/30 focus-visible:border-[#7de2b4]/60 focus-visible:ring-[3px] focus-visible:ring-[#7de2b4]/15"
      />
    </div>
  );
}

// ---------------- جدول جزیره‌ای ----------------
export function AdminDataTable({
  columns,
  children,
  loading,
  isEmpty,
  empty,
  emptyText = "موردی یافت نشد",
  footer,
  minWidth = 760,
}: {
  columns: AdminColumn[];
  children: ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  empty?: ReactNode;
  emptyText?: string;
  footer?: ReactNode;
  minWidth?: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0e1914] p-3 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.95)] sm:p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-white/20 to-transparent" />

      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/6 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-emerald-400/4 blur-3xl" />

      <div className="relative overflow-x-auto">
        <table
          className="w-full border-collapse text-right text-sm"
          style={{ minWidth: `${minWidth}px` }}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "whitespace-nowrap px-2 pb-1.5 pt-0 text-center text-xs font-black tracking-tight text-white/65",
                    alignClass[col.align ?? "center"],
                    col.className,
                  )}
                >
                  <div
                    className={cn(
                      "flex min-h-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5",
                      contentAlignClass[col.align ?? "center"],
                    )}
                  >
                    {col.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-0 py-8">
                  <div className="flex min-h-40 items-center justify-center rounded-[1.6rem] border border-border/70 bg-card/55 text-muted-foreground backdrop-blur-md">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="px-0 py-4">
                  <div className="rounded-[1.6rem] border border-border/70 bg-card/55 px-4 py-8 backdrop-blur-md">
                    {empty ?? <AdminDataTableEmptyState text={emptyText} />}
                  </div>
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>

      {footer && !loading && !isEmpty ? (
        <div className="relative mt-3 rounded-[1.4rem] border border-border/70 bg-background/50 px-4 py-3 backdrop-blur-md">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

// ---------------- ردیف و سلول ----------------
export function AdminDataTableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "group align-middle border-b border-white/[0.07] last:border-b-0",
        "[&>td>div]:bg-transparent",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function AdminDataTableCell({
  children,
  className,
  align = "end",
  islandClassName,
}: {
  children: ReactNode;
  className?: string;
  islandClassName?: string;
  align?: Align;
}) {
  return (
    <td className={cn("px-0 py-0 align-middle", alignClass[align], className)}>
      <div
        className={cn(
          "flex min-h-[66px] flex-col justify-center px-4 py-3 text-white/85 transition-all duration-200",
          "group-hover:bg-white/[0.025]",
          contentAlignClass[align],
          islandClassName,
        )}
      >
        {children}
      </div>
    </td>
  );
}

// ---------------- اکشن‌های ردیف ----------------
export function AdminDataTableActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {children}
    </div>
  );
}

type ActionTone = "default" | "primary" | "danger";

// هر اکشن یک جزیره‌ی کوچک مستقل با مرز و پس‌زمینه‌ی محسوس است.
const actionToneClass: Record<ActionTone, string> = {
  default:
    "text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
  primary: "text-primary hover:border-primary/30 hover:bg-primary/10",
  danger:
    "text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive",
};

export function AdminActionButton({
  icon,
  children,
  tone = "default",
  onClick,
  href,
  external,
  disabled,
  title,
}: {
  icon?: ReactNode;
  children?: ReactNode;
  tone?: ActionTone;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const hasLabel = !!children;

  const base = cn(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/65 bg-background/55 text-xs font-bold shadow-[0_14px_40px_-34px_rgba(0,0,0,0.85)] backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
    hasLabel ? "px-3" : "w-9",
    actionToneClass[tone],
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        title={title}
        aria-label={title}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={base}
      >
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={base}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------- بَج وضعیت ----------------
export function AdminBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black",
        className ?? "border-border/60 bg-background/45 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

// ---------------- وضعیت خالی ----------------
export function AdminDataTableEmptyState({
  text = "موردی یافت نشد",
  description,
  action,
}: {
  text?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background/45 text-muted-foreground">
        <Search className="h-5 w-5" />
      </div>

      <p className="text-sm font-black text-foreground">{text}</p>

      {description ? (
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ---------------- صفحه‌بندی ----------------
export function AdminDataTablePagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground",
        className,
      )}
    >
      <span>
        صفحه {page.toLocaleString("fa-IR")} از{" "}
        {totalPages.toLocaleString("fa-IR")}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="صفحه قبل"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/65 bg-background/45 text-foreground transition-colors hover:border-primary/30 hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label="صفحه بعد"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/65 bg-background/45 text-foreground transition-colors hover:border-primary/30 hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
