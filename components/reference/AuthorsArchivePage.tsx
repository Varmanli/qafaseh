"use client";

import Link from "next/link";
import { Star, UsersRound } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthorArchiveSortMenu from "@/components/reference/AuthorArchiveSortMenu";
import AuthorAvatar from "@/components/reference/AuthorAvatar";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/ui/Pagination";
import { ArchiveFilter } from "@/components/archive/ArchiveFilter";
import { ArchiveSearch, ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import {
  hasActiveAuthorArchiveFilters,
  hasAuthorArchiveSearchChanged,
  toAuthorArchiveSearchParams,
  type AuthorArchiveFilters,
} from "@/lib/reference/author-archive-search";
import type { AuthorArchiveResult } from "@/lib/reference/author-archive";
import { buildAuthorProfileHref } from "@/lib/reference/author-navigation";

function FilterFields({
  filters,
  setFilters,
  countries,
}: {
  filters: AuthorArchiveFilters;
  setFilters: React.Dispatch<React.SetStateAction<AuthorArchiveFilters>>;
  countries: string[];
}) {
  const update = (patch: Partial<AuthorArchiveFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  const ratingOptions: Array<[number | null, string]> = [
    [null, "همه"],
    [3, "۳+"],
    [4, "۴+"],
    [4.5, "۴٫۵+"],
  ];
  return (
    <div className="space-y-5">
      <label className="block border-b border-border/70 pb-5">
        <span className="mb-2 block text-xs font-black">کشور</span>
        <select
          value={filters.country}
          onChange={(event) => update({ country: event.target.value })}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/50"
        >
          <option value="">همه کشورها</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-2 text-xs font-black">حداقل امتیاز</legend>
        <div className="flex flex-wrap gap-2">
          {ratingOptions.map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => update({ minRating: value })}
              className={`h-9 rounded-lg border px-3 text-xs font-bold transition ${filters.minRating === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default function AuthorsArchivePage({
  initialFilters,
  result,
}: {
  initialFilters: AuthorArchiveFilters;
  result: AuthorArchiveResult;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters.q);
  const [isPending, startTransition] = useTransition();
  const activeCount =
    Number(Boolean(filters.country)) +
    Number(filters.minRating !== null);
  useEffect(() => {
    setFilters(initialFilters);
    setQuery(initialFilters.q);
  }, [initialFilters]);
  const navigate = (next: AuthorArchiveFilters, replace = true) => {
    const params = toAuthorArchiveSearchParams(next).toString();
    startTransition(() => {
      const url = params ? `/authors?${params}` : "/authors";
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    });
  };
  useEffect(() => {
    if (!hasAuthorArchiveSearchChanged(filters, query)) return;

    const timer = window.setTimeout(() => {
      const next = { ...filters, q: query, page: 1 };
      navigate(next);
    }, 250);
    return () => window.clearTimeout(timer); // navigation is intentionally debounced only for search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, query]);
  const apply = (next: AuthorArchiveFilters) => navigate(next);
  const reset = () => {
    const next = {
      ...filters,
      country: "",
      minRating: null,
      page: 1,
    };
    setFilters(next);
    apply(next);
  };
  const setArchiveFilters: React.Dispatch<
    React.SetStateAction<AuthorArchiveFilters>
  > = (update) => {
    const next = typeof update === "function" ? update(filters) : update;
    setFilters(next);
    apply(next);
  };
  return (
    <div dir="rtl" className="space-y-7 sm:space-y-9">
      <ArchiveToolbar label="ابزارهای مرور نویسنده‌ها">
        <ArchiveSearch
          value={query}
          onChange={setQuery}
          placeholder="جستجو در نویسنده‌ها..."
          ariaLabel="جست‌وجوی نویسنده"
        />

        <div className="order-[1] shrink-0 lg:order-3">
          <AuthorArchiveSortMenu
            value={filters.sort}
            onChange={(sort) =>
              setArchiveFilters((current) => ({
                ...current,
                sort,
                page: 1,
              }))
            }
          />
        </div>

        <ArchiveFilter
          title="فیلتر نویسنده‌ها"
          description="نتیجه را بر اساس کشور و امتیاز محدود کن"
          label="فیلتر نویسنده‌ها"
          activeCount={activeCount}
          onReset={hasActiveAuthorArchiveFilters(filters) ? reset : undefined}
          desktopWidthClassName="w-[360px]"
        >
          <FilterFields
            filters={filters}
            setFilters={setArchiveFilters}
            countries={result.countries}
          />
        </ArchiveFilter>
      </ArchiveToolbar>
      <section
        className={
          isPending ? "opacity-65 transition-opacity" : "transition-opacity"
        }
      >
        {result.items.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-border/70 bg-card/50 px-6 py-14 text-center">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><UsersRound aria-hidden="true" className="size-5" /></span>
            <h2 className="text-xl font-black">نویسنده‌ای پیدا نشد</h2>
            <p className="mt-2 text-sm text-muted-foreground">عبارت جست‌وجو یا فیلترها را تغییر بده و دوباره بگرد.</p>
            {hasActiveAuthorArchiveFilters(filters) ? (
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                className="mt-5"
              >
                پاک کردن فیلترها
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 min-[430px]:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {result.items.map((item) => (
                <Link
                  key={item.id}
                  href={buildAuthorProfileHref(
                    item.slug ?? item.name,
                    searchParams.toString(),
                  )}
                  className="group flex flex-col items-center text-center focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <AuthorAvatar
                    name={item.name}
                    image={item.coverImage}
                    sizeClassName="h-24 w-24 min-[390px]:h-28 min-[390px]:w-28 sm:h-32 sm:w-32"
                    className="transition-transform duration-200 group-hover:scale-105"
                  />
                  <h2 className="mt-3 line-clamp-2 max-w-full font-black leading-6 tracking-tight text-foreground/90 group-hover:text-primary">
                    {item.name}
                  </h2>
                  {item.averageRating !== null ? <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Star aria-hidden="true" className="size-3.5 fill-amber-400 text-amber-400" />{item.averageRating.toLocaleString("fa-IR")}</span> : null}
                </Link>
              ))}
            </div>
            {result.pageCount > 1 ? (
              <Pagination
                currentPage={result.page}
                totalPages={result.pageCount}
                pathname="/authors"
                searchParams={searchParams.toString()}
                ariaLabel="صفحه‌بندی نویسنده‌ها"
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
