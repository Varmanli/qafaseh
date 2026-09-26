"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import AuthorAvatar from "@/components/reference/AuthorAvatar";
import type {
  ReferenceItemDTO,
  ReferenceSearchPage,
} from "@/lib/reference/service";

function toReferenceSearchParams(q: string, page: number) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  return params;
}

function Pagination({
  page,
  pageCount,
  onNavigate,
}: {
  page: number;
  pageCount: number;
  onNavigate: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.6rem] border border-border/75 bg-card/70 px-4 py-3">
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-2xl"
        disabled={page <= 1}
        onClick={() => onNavigate(page - 1)}
      >
        <ChevronRight className="h-4 w-4" />
        صفحه قبل
      </Button>
      <p className="text-sm text-muted-foreground">
        صفحه {page.toLocaleString("fa-IR")} از{" "}
        {pageCount.toLocaleString("fa-IR")}
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-2xl"
        disabled={page >= pageCount}
        onClick={() => onNavigate(page + 1)}
      >
        صفحه بعد
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ReferenceArchivePage({
  initialQuery,
  result,
  routeBase,
  searchPlaceholder,
  emptyTitle,
  loadMoreEndpoint,
}: {
  initialQuery: string;
  result: ReferenceSearchPage;
  routeBase: "/authors" | "/translators" | "/publishers";
  searchPlaceholder: string;
  emptyTitle: string;
  /** Enables append-only pagination for public directories such as authors. */
  loadMoreEndpoint?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState(result.items);
  const [loadedPage, setLoadedPage] = useState(result.page);
  const [hasMore, setHasMore] = useState(result.page < result.pageCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const currentParams = useMemo(
    () => toReferenceSearchParams(initialQuery, result.page).toString(),
    [initialQuery, result.page],
  );

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // A server navigation (search/clear-search) establishes a new result set.
  // Reset the appended client pages only at that boundary.
  useEffect(() => {
    setItems(result.items);
    setLoadedPage(result.page);
    setHasMore(result.page < result.pageCount);
    setLoadMoreError(null);
  }, [initialQuery, result.items, result.page, result.pageCount]);

  useEffect(() => {
    const nextParams = toReferenceSearchParams(query, 1).toString();
    if (nextParams === currentParams) return;

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(nextParams ? `${pathname}?${nextParams}` : pathname, {
          scroll: false,
        });
      });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [currentParams, pathname, query, router, startTransition]);

  const navigateToPage = (page: number) => {
    const params = toReferenceSearchParams(initialQuery, page).toString();
    startTransition(() => {
      router.push(params ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    });
  };

  const clearSearch = () => {
    setQuery("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const loadMore = async () => {
    if (!loadMoreEndpoint || isLoadingMore || !hasMore || isPending) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const params = new URLSearchParams({
        page: String(loadedPage + 1),
        limit: String(result.pageSize),
      });
      if (initialQuery.trim()) params.set("q", initialQuery.trim());

      const response = await fetch(`${loadMoreEndpoint}?${params}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        items?: ReferenceItemDTO[];
        page?: number;
        hasMore?: boolean;
      };

      if (!response.ok || !data.ok || !data.items || !data.page) {
        throw new Error(data.error || "بارگذاری نویسنده‌ها ناموفق بود");
      }

      setItems((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...data.items!.filter((item) => !ids.has(item.id))];
      });
      setLoadedPage(data.page);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      setLoadMoreError(
        error instanceof Error ? error.message : "بارگذاری نویسنده‌ها ناموفق بود",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-14 w-full rounded-[1.8rem] border border-border/70 bg-card/70 pr-12 pl-4 text-sm text-foreground shadow-[0_24px_80px_-60px_rgba(0,0,0,0.7)] outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/15 sm:text-base"
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
              aria-label="پاک کردن جستجو"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-[1.8rem] border border-dashed border-border/70 bg-card/50 px-6 py-14 text-center">
          <h2 className="text-xl font-black text-foreground">{emptyTitle}</h2>
          {initialQuery ? (
            <Button
              type="button"
              variant="ghost"
              onClick={clearSearch}
              className="mt-5 h-10 rounded-2xl"
            >
              پاک کردن جستجو
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            className={
              routeBase === "/authors"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
                : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {items.map((item) => (
              <Link
                key={item.id}
                href={`${item.type === "AUTHOR" ? "/authors" : item.type === "TRANSLATOR" ? "/translators" : routeBase}/${encodeURIComponent(item.slug ?? item.name)}`}
                className="group block"
              >
                {routeBase === "/authors" ? (
                  <article className="group flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="pointer-events-none absolute -inset-2 rounded-full bg-primary/10 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />

                      <div className="relative rounded-full p-1 transition-transform duration-300 group-hover:-translate-y-1">
                        <AuthorAvatar
                          name={item.name}
                          image={item.coverImage}
                          sizeClassName="h-40 w-40"
                        />
                      </div>
                    </div>

                    <h2 className="mt-3 line-clamp-1 max-w-full font-black leading-6 tracking-tight text-foreground/90 transition-colors duration-200 group-hover:text-primary">
                      {item.name}
                    </h2>
                  </article>
                ) : (
                  <article className="flex items-center gap-4 rounded-[1.6rem] border border-border/70 bg-card/65 p-4 transition-colors duration-200 group-hover:border-primary/25 group-hover:bg-primary/[0.04]">
                    <AuthorAvatar
                      name={item.name}
                      image={item.coverImage}
                      sizeClassName="h-16 w-16"
                      textClassName="text-xl"
                      iconClassName="h-6 w-6"
                    />
                    <div className="min-w-0">
                      <h2 className="line-clamp-1 font-black text-foreground transition-colors group-hover:text-primary">
                        {item.name}
                      </h2>
                    </div>
                  </article>
                )}
              </Link>
            ))}
          </div>

          {loadMoreEndpoint ? (
            <div className="pt-3 text-center" aria-busy={isLoadingMore}>
              {hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoadingMore || isPending}
                  className="h-11 min-w-40 rounded-2xl px-5 font-bold focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  {isLoadingMore ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      در حال بارگذاری…
                    </>
                  ) : (
                    "مشاهده بیشتر"
                  )}
                </Button>
              ) : null}

              {loadMoreError ? (
                <p role="alert" className="mt-3 text-xs font-medium text-destructive">
                  {loadMoreError}
                </p>
              ) : null}
            </div>
          ) : (
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              onNavigate={navigateToPage}
            />
          )}
        </>
      )}

      {isPending ? (
        <p className="text-center text-xs text-muted-foreground">
          در حال به‌روزرسانی نتایج...
        </p>
      ) : null}
    </div>
  );
}
