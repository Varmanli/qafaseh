"use client";

import Link from "next/link";
import { BookOpen, MapPin, Star, UsersRound } from "lucide-react";
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
  const bookOptions: Array<[number | null, string]> = [
    [null, "همه"],
    [5, "۵+"],
    [10, "۱۰+"],
    [20, "۲۰+"],
  ];
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
      <fieldset className="border-b border-border/70 pb-5">
        <legend className="mb-2 text-xs font-black">حداقل کتاب</legend>
        <div className="flex flex-wrap gap-2">
          {bookOptions.map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => update({ minBooks: value })}
              className={`h-9 rounded-lg border px-3 text-xs font-bold transition ${filters.minBooks === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
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
    Number(filters.minBooks !== null) +
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
      minBooks: null,
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
      <header className="relative isolate overflow-hidden rounded-[2rem] border border-primary/10 bg-gradient-to-br from-primary/[0.10] via-card to-card px-5 py-7 shadow-sm sm:px-9 sm:py-10">
        <div aria-hidden="true" className="absolute -left-14 -top-20 -z-10 size-64 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 text-xs font-bold text-primary shadow-sm">
              <UsersRound aria-hidden="true" className="size-4" />
              <span>راهنمای نویسندگان قفسه</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">نویسنده‌ها</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              نویسندهٔ بعدی کتابت را پیدا کن؛ آثار هر نویسنده بر اساس کتاب‌هایی شمرده می‌شوند که نوشته است.
            </p>
          </div>
          <div className="flex w-fit items-center gap-3 rounded-2xl border border-border/70 bg-background/75 px-4 py-3 shadow-sm backdrop-blur">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UsersRound aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-2xl font-black tabular-nums leading-none">{result.totalCount.toLocaleString("fa-IR")}</span>
              <span className="mt-1 block text-xs font-semibold text-muted-foreground">نویسندهٔ تأییدشده</span>
            </span>
          </div>
        </div>
      </header>

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
          description="نتیجه را بر اساس کشور، تعداد کتاب و امتیاز محدود کن"
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
      <main
        className={
          isPending ? "opacity-65 transition-opacity" : "transition-opacity"
        }
      >
        <div className="mb-4 flex items-center justify-between gap-3 px-1 text-sm">
          <p className="font-bold text-foreground">{filters.q || filters.country || filters.minBooks || filters.minRating ? "نتایج جست‌وجو" : "چهره‌های ادبی"}</p>
          <p className="text-xs font-medium text-muted-foreground">{result.totalCount.toLocaleString("fa-IR")} نویسنده</p>
        </div>
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
                  className="group block rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <article className="flex h-full min-h-56 flex-col items-center rounded-[1.5rem] border border-border/70 bg-card px-3 py-5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.025)] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/25 group-hover:shadow-lg group-hover:shadow-primary/[0.06] sm:min-h-60 sm:px-4 sm:py-6">
                    <div className="relative mb-1 rounded-full bg-gradient-to-br from-primary/20 to-transparent p-1 transition-transform duration-300 group-hover:scale-[1.04]">
                      <AuthorAvatar
                        name={item.name}
                        image={item.coverImage}
                        sizeClassName="h-24 w-24 min-[390px]:h-28 min-[390px]:w-28 sm:h-32 sm:w-32"
                      />
                    </div>
                    <h2 className="mt-3 line-clamp-2 min-h-12 max-w-full font-black leading-6 tracking-tight text-foreground/90 group-hover:text-primary">
                      {item.name}
                    </h2>
                    {item.countryName ? <p className="mt-1 flex max-w-full items-center gap-1 truncate text-xs font-medium text-muted-foreground"><MapPin aria-hidden="true" className="size-3 shrink-0" />{item.countryName}</p> : <span className="mt-1 h-4" />}
                    <div className="mt-auto flex w-full items-center justify-center gap-2 border-t border-border/60 pt-4 text-xs font-bold text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><BookOpen aria-hidden="true" className="size-3.5 text-primary" />{item.bookCount.toLocaleString("fa-IR")} کتاب</span>
                      {item.averageRating !== null ? <span className="inline-flex items-center gap-1 border-r border-border pr-2"><Star aria-hidden="true" className="size-3.5 fill-amber-400 text-amber-400" />{item.averageRating.toLocaleString("fa-IR")}</span> : null}
                    </div>
                  </article>
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
      </main>
    </div>
  );
}
