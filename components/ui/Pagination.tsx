import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  buildPaginationHref,
  getPaginationItems,
  type PaginationSearchParams,
} from "@/lib/pagination";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  pathname: string;
  searchParams: PaginationSearchParams;
  ariaLabel: string;
};

export default function Pagination({
  currentPage,
  totalPages,
  pathname,
  searchParams,
  ariaLabel,
}: PaginationProps) {
  const safeTotal = Math.max(1, Math.trunc(totalPages));
  const page = Math.min(safeTotal, Math.max(1, Math.trunc(currentPage)));

  if (safeTotal <= 1) return null;

  const hrefFor = (targetPage: number) =>
    buildPaginationHref(pathname, searchParams, targetPage);

  const items = getPaginationItems(page, safeTotal);

  const previousPage = page - 1;
  const nextPage = page + 1;

  return (
    <nav
      aria-label={ariaLabel}
      className="mt-10 flex min-w-0 items-center justify-center border-t border-border/60 pt-7 sm:mt-12 sm:pt-8"
    >
      <div className="flex items-center gap-1.5 rounded-2xl border border-border/70 bg-background/80 p-1.5 shadow-sm sm:gap-2">
        <PageLink
          href={page > 1 ? hrefFor(1) : undefined}
          label="صفحه اول"
          className="hidden sm:inline-flex"
        >
          <ChevronsRight className="size-4" />
        </PageLink>

        <PageLink
          href={page > 1 ? hrefFor(previousPage) : undefined}
          label="صفحه قبل"
        >
          <ChevronRight className="size-4" />
          <span className="hidden text-xs font-semibold sm:inline">قبلی</span>
        </PageLink>

        <div
          className="hidden items-center gap-1 sm:flex"
          aria-label="شماره صفحه‌ها"
        >
          {items.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="flex size-9 select-none items-center justify-center text-xs font-medium text-muted-foreground/60"
              >
                •••
              </span>
            ) : (
              <Link
                key={item}
                href={hrefFor(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`صفحه ${item.toLocaleString("fa-IR")}`}
                className={
                  item === page
                    ? "inline-flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-bold tabular-nums text-primary-foreground shadow-sm"
                    : "inline-flex size-9 items-center justify-center rounded-xl text-xs font-semibold tabular-nums text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                }
              >
                {item.toLocaleString("fa-IR")}
              </Link>
            ),
          )}
        </div>

        {/* Mobile */}
        <div
          className="flex min-w-[84px] items-center justify-center gap-1 rounded-xl bg-muted/60 px-3 py-2 text-xs font-bold tabular-nums sm:hidden"
          aria-current="page"
        >
          <span className="text-foreground">
            {page.toLocaleString("fa-IR")}
          </span>

          <span className="text-muted-foreground/50">از</span>

          <span className="text-muted-foreground">
            {safeTotal.toLocaleString("fa-IR")}
          </span>
        </div>

        <PageLink
          href={page < safeTotal ? hrefFor(nextPage) : undefined}
          label="صفحه بعد"
        >
          <span className="hidden text-xs font-semibold sm:inline">بعدی</span>
          <ChevronLeft className="size-4" />
        </PageLink>

        <PageLink
          href={page < safeTotal ? hrefFor(safeTotal) : undefined}
          label="صفحه آخر"
          className="hidden sm:inline-flex"
        >
          <ChevronsLeft className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  label,
  className = "",
  children,
}: {
  href?: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const styles = `
    inline-flex
    h-9
    w-9
    shrink-0
    items-center
    justify-center
    gap-1.5
    rounded-xl
    text-muted-foreground
    transition-all
    duration-200
    hover:bg-muted
    hover:text-foreground
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-primary/30
    sm:w-auto
    sm:px-3
    ${className}
  `;

  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={`${styles} cursor-not-allowed opacity-30`}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={styles}>
      {children}
    </Link>
  );
}
