"use client";

import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { FiStar } from "react-icons/fi";

import BookArchiveFilterDrawer from "@/components/books/BookArchiveFilterDrawer";
import BookArchiveFiltersPanel from "@/components/books/BookArchiveFiltersPanel";
import BookArchiveSortMenu from "@/components/books/BookArchiveSortMenu";
import BookCoverImage from "@/components/books/BookCoverImage";
import { Button } from "@/components/ui/button";

import {
  DEFAULT_BOOK_ARCHIVE_FILTERS,
  hasActiveBookArchiveFilters,
  toBookArchiveSearchParams,
  type BookArchiveFilterOptions,
  type BookArchiveFilters,
} from "@/lib/book/archive-search";

import { getPublicBookHref } from "@/lib/book/public-href";
import { resolveBookPresentation } from "@/lib/book/presentation";

import type {
  BookArchiveItem,
  BookArchiveResult,
} from "@/lib/book/archive-service";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function bookHref(book: BookArchiveItem) {
  const presentation = resolveBookPresentation(book, book.displayEdition);

  return getPublicBookHref({
    ...book,
    editionId: presentation.linkEditionId,
  });
}

function getActiveFilterCount(filters: BookArchiveFilters) {
  return [
    filters.genre,
    filters.author,
    filters.translator,
    filters.publisher,
    filters.country,
    filters.language,

    filters.hasCover !== "any",

    filters.minPages !== null,
    filters.maxPages !== null,

    filters.minRating !== null,
    filters.maxRating !== null,

    filters.minYear !== null,
    filters.maxYear !== null,

  ].filter(Boolean).length;
}

function getPaginationItems(currentPage: number, pageCount: number) {
  const pages = new Set([
    1,
    pageCount,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    const previous = sortedPages[index - 1];

    if (previous && page - previous > 1) {
      items.push("ellipsis");
    }

    items.push(page);
  });

  return items;
}

/* -------------------------------------------------------------------------- */
/*                               Filter button                                */
/* -------------------------------------------------------------------------- */

const FilterButton = forwardRef<
  HTMLButtonElement,
  {
    activeCount: number;
    expanded?: boolean;
    controls?: string;
    onClick?: () => void;
  }
>(function FilterButton({ activeCount, expanded, controls, onClick }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      aria-label="فیلتر کتاب‌ها"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className="
        relative

        h-12
        w-12
        shrink-0

        rounded-[1rem]

        border
        border-border

        bg-card

        p-0

        text-foreground

        shadow-[0_2px_8px_-5px_rgba(0,0,0,0.18)]

        transition-all
        duration-200

        hover:border-primary/40
        hover:bg-primary/[0.06]
        hover:text-primary

        focus-visible:ring-2
        focus-visible:ring-primary/20

        sm:h-[50px]
        sm:w-[50px]
      "
    >
      <SlidersHorizontal aria-hidden="true" className="h-[18px] w-[18px]" />

      {activeCount > 0 ? (
        <span
          className="
            absolute
            -right-1.5
            -top-1.5

            flex
            h-5
            min-w-5

            items-center
            justify-center

            rounded-full

            border-2
            border-background

            bg-primary

            px-1

            text-[9px]
            font-black
            leading-none

            text-primary-foreground
          "
        >
          {activeCount.toLocaleString("fa-IR")}
        </span>
      ) : null}
    </Button>
  );
});

/* -------------------------------------------------------------------------- */
/*                                Search input                                */
/* -------------------------------------------------------------------------- */

function ArchiveSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="group relative min-w-0 flex-1">
      <Search
        aria-hidden="true"
        className="
          pointer-events-none

          absolute
          right-4
          top-1/2
          z-10

          h-[18px]
          w-[18px]

          -translate-y-1/2

          text-muted-foreground

          transition-colors
          duration-200

          group-focus-within:text-primary
        "
      />

      <input
        type="search"
        dir="rtl"
        name="book-search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="جست‌وجوی کتاب"
        className="
          h-14
          w-full

          rounded-[1rem]

          border
          border-border

          bg-card

          pr-11
          pl-11

          text-right
          text-[15px]
          font-medium

          text-foreground

          outline-none

          shadow-[0_2px_8px_-5px_rgba(0,0,0,0.18)]

          transition-all
          duration-200

          placeholder:text-muted-foreground/80
          placeholder:opacity-100
          placeholder:font-medium

          hover:border-foreground/20

          focus:border-primary/50
          focus:ring-[3px]
          focus:ring-primary/10

          sm:h-14
          sm:text-[15px]

          [unicode-bidi:plaintext]
        "
      />

      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="پاک کردن جست‌وجو"
          className="
            absolute
            left-3
            top-1/2

            flex
            h-7
            w-7

            -translate-y-1/2

            items-center
            justify-center

            rounded-full

            text-muted-foreground

            transition-all
            duration-200

            hover:bg-muted
            hover:text-foreground
          "
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Book card                                 */
/* -------------------------------------------------------------------------- */

function BookArchiveCard({ book }: { book: BookArchiveItem }) {
  const href = bookHref(book);

  const presentation = resolveBookPresentation(book, book.displayEdition);

  const coverSrc = presentation.coverImage || "/placeholder-cover.svg";

  const ratingLabel =
    book.averageRating != null
      ? book.averageRating.toLocaleString("fa-IR", {
          maximumFractionDigits: 1,
        })
      : null;

  const editionMeta = [presentation.publisher, presentation.translator]
    .filter(Boolean)
    .join(" • ");

  const content = (
    <article
      className="
        group/card

        flex
        h-full
        flex-col

        rounded-[1.25rem]

        border
        border-border/90

        bg-card

        p-2.5

        shadow-[0_8px_26px_-18px_rgba(0,0,0,0.28)]

        transition-all
        duration-300
        ease-out

        hover:-translate-y-1

        hover:border-primary/30

        hover:shadow-[0_18px_42px_-24px_rgba(0,0,0,0.4)]

        sm:rounded-[1.4rem]
        sm:p-3

        dark:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.85)]
        dark:hover:border-primary/40
      "
    >
      {/* Cover */}

      <div
        className="
          relative

          overflow-hidden

          rounded-[1rem]

          bg-muted

          shadow-[0_8px_24px_-18px_rgba(0,0,0,0.55)]

          sm:rounded-[1.1rem]
        "
      >
        <div className="relative aspect-[2/3]">
          <BookCoverImage
            src={coverSrc}
            alt={presentation.title}
            fill
            sizes="
              (max-width: 640px) 44vw,
              (max-width: 1024px) 30vw,
              (max-width: 1280px) 23vw,
              18vw
            "
            className="
              object-cover

              transition-transform
              duration-500
              ease-out

              group-hover/card:scale-[1.025]
            "
          />
        </div>

        {/* Cover gradient */}

        <div
          className="
            pointer-events-none

            absolute
            inset-x-0
            bottom-0

            h-16

            bg-gradient-to-t
            from-black/35
            via-black/10
            to-transparent
          "
        />

        {/* Rating */}

        {ratingLabel ? (
          <div
            className="
              absolute
              bottom-2
              left-2

              inline-flex
              h-7

              items-center

              gap-1.5

              rounded-full

              border
              border-white/20

              bg-black/60

              px-2.5

              text-[10px]
              font-black

              text-white

              shadow-sm

              backdrop-blur-md

              sm:bottom-2.5
              sm:left-2.5
            "
          >
            <FiStar
              className="
                h-3
                w-3

                fill-amber-400
                text-amber-400
              "
            />

            <span className="tabular-nums">{ratingLabel}</span>
          </div>
        ) : null}
      </div>

      {/* Content */}

      <div
        className="
          flex
          flex-1
          flex-col

          px-1
          pb-1
          pt-3

          text-right

          sm:px-1.5
          sm:pt-3.5
        "
      >
        <h2
          className="
            line-clamp-2

            min-h-[2.9rem]

            text-[13px]
            font-black
            leading-[1.5rem]

            tracking-tight

            text-foreground

            transition-colors
            duration-200

            group-hover/card:text-primary

            sm:min-h-[3.15rem]
            sm:text-[14px]
            sm:leading-[1.6rem]
          "
        >
          {presentation.title}
        </h2>

        <p
          className="
            mt-1.5

            line-clamp-1

            text-[11px]
            font-semibold

            text-muted-foreground

            sm:text-xs
          "
        >
          {book.author || "نویسنده نامشخص"}
        </p>

        {presentation.linkEditionId && editionMeta ? (
          <div
            className="
              mt-auto
              pt-3
            "
          >
            <div
              className="
                border-t
                border-border/60

                pt-2.5
              "
            >
              <p
                className="
                  line-clamp-1

                  text-[10px]
                  font-medium

                  text-muted-foreground/80

                  sm:text-[11px]
                "
              >
                {editionMeta}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="
        block
        h-full

        rounded-[1.25rem]

        outline-none

        focus-visible:ring-2
        focus-visible:ring-primary/40

        focus-visible:ring-offset-3
        focus-visible:ring-offset-background
      "
    >
      {content}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Pagination                                 */
/* -------------------------------------------------------------------------- */

function Pagination({
  archive,
  onPatch,
}: {
  archive: BookArchiveResult;
  onPatch: (patch: Partial<BookArchiveFilters>) => void;
}) {
  if (archive.pageCount <= 1) {
    return null;
  }

  const pageItems = getPaginationItems(archive.page, archive.pageCount);

  return (
    <nav
      aria-label="صفحه‌بندی کتاب‌ها"
      className="
        mt-8

        flex
        items-center
        justify-center

        gap-1.5

        border-t
        border-border/70

        pt-6

        sm:mt-10
        sm:gap-2
        sm:pt-8
      "
    >
      <Button
        type="button"
        variant="ghost"
        disabled={archive.page <= 1}
        onClick={() =>
          onPatch({
            page: archive.page - 1,
          })
        }
        aria-label="صفحه قبل"
        className="
          h-9
          w-9

          rounded-xl

          p-0

          sm:w-auto
          sm:px-3
        "
      >
        <ChevronRight className="h-4 w-4" />

        <span className="hidden text-xs font-bold sm:inline">قبلی</span>
      </Button>

      <div className="hidden items-center gap-1 sm:flex">
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="
                flex
                h-9
                w-7

                items-center
                justify-center

                text-xs
                text-muted-foreground
              "
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant="ghost"
              aria-current={item === archive.page ? "page" : undefined}
              aria-label={`صفحه ${item.toLocaleString("fa-IR")}`}
              onClick={() =>
                onPatch({
                  page: item,
                })
              }
              className={`
                h-9
                min-w-9

                rounded-xl

                px-2

                text-xs
                font-bold
                tabular-nums

                ${
                  item === archive.page
                    ? `
                      bg-foreground
                      text-background

                      hover:bg-foreground
                      hover:text-background
                    `
                    : `
                      text-muted-foreground
                      hover:text-foreground
                    `
                }
              `}
            >
              {item.toLocaleString("fa-IR")}
            </Button>
          ),
        )}
      </div>

      <span
        className="
          min-w-[76px]

          text-center
          text-xs
          font-black

          text-foreground

          sm:hidden
        "
      >
        {archive.page.toLocaleString("fa-IR")}

        <span className="mx-1 text-muted-foreground">/</span>

        {archive.pageCount.toLocaleString("fa-IR")}
      </span>

      <Button
        type="button"
        variant="ghost"
        disabled={archive.page >= archive.pageCount}
        onClick={() =>
          onPatch({
            page: archive.page + 1,
          })
        }
        aria-label="صفحه بعد"
        className="
          h-9
          w-9

          rounded-xl

          p-0

          sm:w-auto
          sm:px-3
        "
      >
        <span className="hidden text-xs font-bold sm:inline">بعدی</span>

        <ChevronLeft className="h-4 w-4" />
      </Button>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Empty state                                 */
/* -------------------------------------------------------------------------- */

function EmptyArchive({
  hasActiveFilters,
  onReset,
}: {
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div
      className="
        flex
        min-h-[360px]

        flex-col

        items-center
        justify-center

        px-6
        py-14

        text-center
      "
    >
      <div
        className="
          flex

          h-14
          w-14

          items-center
          justify-center

          rounded-[1rem]

          border
          border-border

          bg-card

          text-muted-foreground

          shadow-sm
        "
      >
        <BookOpen className="h-6 w-6" />
      </div>

      <h2
        className="
          mt-5

          text-base
          font-black

          text-foreground

          sm:text-lg
        "
      >
        کتابی پیدا نشد
      </h2>

      <p
        className="
          mt-2

          max-w-sm

          text-xs
          font-medium
          leading-6

          text-muted-foreground

          sm:text-sm
          sm:leading-7
        "
      >
        عبارت جست‌وجو یا فیلترهای انتخاب‌شده را تغییر بده.
      </p>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          className="
            mt-5

            h-10

            rounded-xl

            px-4

            text-xs
            font-bold
          "
        >
          پاک کردن فیلترها
        </Button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Main component                                */
/* -------------------------------------------------------------------------- */

export default function BookArchiveFilters({
  filters,
  options,
  archive,
  searchPlaceholder = "نام کتاب، نویسنده، مترجم یا ناشر...",
  hideGenreFilter = false,
  hideAuthorFilter = false,
  hideTranslatorFilter = false,
  hidePublisherFilter = false,
  hideCountryFilter = false,
  showDiscoveryHeader = false,
}: {
  filters: BookArchiveFilters;
  options: BookArchiveFilterOptions;
  archive: BookArchiveResult;
  searchPlaceholder?: string;
  hideGenreFilter?: boolean;
  hideAuthorFilter?: boolean;
  hideTranslatorFilter?: boolean;
  hidePublisherFilter?: boolean;
  hideCountryFilter?: boolean;
  showDiscoveryHeader?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [isPending, startTransition] = useTransition();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

  const [draft, setDraft] = useState(filters);

  const [searchQuery, setSearchQuery] = useState(filters.q);

  const hasPendingSearchRef = useRef(false);

  const desktopFilterButtonRef = useRef<HTMLButtonElement>(null);

  const desktopFilterPanelRef = useRef<HTMLDivElement>(null);

  const currentParams = useMemo(
    () => toBookArchiveSearchParams(filters).toString(),
    [filters],
  );

  const hasActiveFilters = useMemo(
    () => hasActiveBookArchiveFilters(filters),
    [filters],
  );

  const activeFilterCount = useMemo(
    () => getActiveFilterCount(filters),
    [filters],
  );

  /* ---------------------------------------------------------------------- */
  /* Desktop filters                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!desktopFiltersOpen) {
      return;
    }

    const closeWhenOutside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        !desktopFilterButtonRef.current?.contains(target) &&
        !desktopFilterPanelRef.current?.contains(target)
      ) {
        setDesktopFiltersOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDesktopFiltersOpen(false);

        desktopFilterButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeWhenOutside);

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);

      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [desktopFiltersOpen]);

  /* ---------------------------------------------------------------------- */
  /* Sync URL -> state                                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (hasPendingSearchRef.current && filters.q !== searchQuery) {
      return;
    }

    setDraft(filters);
    setSearchQuery(filters.q);

    hasPendingSearchRef.current = false;
  }, [filters, searchQuery]);

  /* ---------------------------------------------------------------------- */
  /* Debounce URL update                                                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const nextParams = toBookArchiveSearchParams(draft).toString();

    if (nextParams === currentParams) {
      return;
    }

    const delay = draft.q !== filters.q ? 250 : 0;

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(nextParams ? `${pathname}?${nextParams}` : pathname, {
          scroll: false,
        });
      });
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentParams, draft, filters.q, pathname, router, startTransition]);

  /* ---------------------------------------------------------------------- */

  const navigateWithFilters = (
    nextFilters: BookArchiveFilters,
    method: "push" | "replace" = "push",
  ) => {
    startTransition(() => {
      const params = toBookArchiveSearchParams(nextFilters).toString();

      const href = params ? `${pathname}?${params}` : pathname;

      if (method === "replace") {
        router.replace(href, {
          scroll: false,
        });
      } else {
        router.push(href, {
          scroll: false,
        });
      }
    });
  };

  const patchFilters = (patch: Partial<BookArchiveFilters>) => {
    const nextFilters = {
      ...filters,
      ...patch,
    };

    setDraft(nextFilters);

    navigateWithFilters(nextFilters);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_BOOK_ARCHIVE_FILTERS);

    setSearchQuery(DEFAULT_BOOK_ARCHIVE_FILTERS.q);

    navigateWithFilters(DEFAULT_BOOK_ARCHIVE_FILTERS, "replace");
  };

  const handleSearchChange = (value: string) => {
    hasPendingSearchRef.current = true;

    setSearchQuery(value);

    setDraft((current) => ({
      ...current,
      q: value,
      page: 1,
    }));
  };

  const handleSortChange = (sort: BookArchiveFilters["sort"]) => {
    setDraft((current) => ({ ...current, sort, page: 1 }));
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      dir="rtl"
      className="
        w-full

        space-y-5

        sm:space-y-6
      "
    >
      {/* ------------------------------------------------------------------ */}
      {/* Search + Filter                                                    */}
      {/* ------------------------------------------------------------------ */}

      <section className="relative z-20 mx-auto w-full max-w-5xl">
        {showDiscoveryHeader ? (
          <div className="mb-4 px-1 sm:mb-5">
            <p className="text-xs font-bold text-primary">کشف کتاب</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
              کتاب بعدی‌ات را پیدا کن
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              عنوان، نویسنده، مترجم، ناشر یا نام یک نسخه را جست‌وجو کن.
            </p>
          </div>
        ) : null}
        <div
          className="
            flex
            items-center

            gap-2

            sm:gap-3
          "
        >
          <ArchiveSearch
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
          />

          {/* Mobile */}

          <div className="lg:hidden">
            <BookArchiveFilterDrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              draft={draft}
              setDraft={setDraft}
              options={options}
              pending={isPending}
              onReset={resetFilters}
              hideGenreFilter={hideGenreFilter}
              hideAuthorFilter={hideAuthorFilter}
              hideTranslatorFilter={hideTranslatorFilter}
              hidePublisherFilter={hidePublisherFilter}
              hideCountryFilter={hideCountryFilter}
              trigger={<FilterButton activeCount={activeFilterCount} />}
            />
          </div>

          <div className="shrink-0 lg:order-3">
            <BookArchiveSortMenu
              value={draft.sort}
              onChange={handleSortChange}
            />
          </div>

          {/* Desktop */}

          <div className="relative hidden lg:block">
            <FilterButton
              ref={desktopFilterButtonRef}
              activeCount={activeFilterCount}
              expanded={desktopFiltersOpen}
              controls="book-archive-filters"
              onClick={() => setDesktopFiltersOpen((open) => !open)}
            />

            {desktopFiltersOpen ? (
              <div
                id="book-archive-filters"
                ref={desktopFilterPanelRef}
                role="dialog"
                aria-label="فیلتر کتاب‌ها"
                className="
                  absolute
                  left-0
                  top-[calc(100%+10px)]
                  z-50

                  max-h-[calc(100vh-120px)]

                  w-[360px]

                  overflow-y-auto

                  rounded-[1.4rem]

                  border
                  border-border

                  bg-card

                  p-4

                  shadow-[0_24px_70px_-24px_rgba(0,0,0,0.45)]

                  xl:w-[380px]
                "
              >
                <div
                  className="
                    mb-4

                    flex

                    items-center
                    justify-between

                    gap-3
                  "
                >
                  <div>
                    <h2
                      className="
                        text-sm
                        font-black

                        text-foreground
                      "
                    >
                      فیلتر کتاب‌ها
                    </h2>

                    {activeFilterCount > 0 ? (
                      <p
                        className="
                          mt-1

                          text-[11px]
                          font-semibold

                          text-muted-foreground
                        "
                      >
                        {activeFilterCount.toLocaleString("fa-IR")} فیلتر فعال
                      </p>
                    ) : null}
                  </div>

                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetFilters}
                      className="
                        h-8

                        rounded-lg

                        px-2.5

                        text-[11px]
                        font-bold

                        text-muted-foreground

                        hover:text-foreground
                      "
                    >
                      پاک کردن
                    </Button>
                  ) : null}
                </div>

                <BookArchiveFiltersPanel
                  draft={draft}
                  setDraft={setDraft}
                  options={options}
                  pending={isPending}
                  hideGenreFilter={hideGenreFilter}
                  hideAuthorFilter={hideAuthorFilter}
                  hideTranslatorFilter={hideTranslatorFilter}
                  hidePublisherFilter={hidePublisherFilter}
                  hideCountryFilter={hideCountryFilter}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Books                                                              */}
      {/* ------------------------------------------------------------------ */}

      <main
        className={`
          min-w-0

          transition-opacity
          duration-200

          ${isPending ? "opacity-65" : "opacity-100"}
        `}
      >
        {archive.items.length === 0 ? (
          <EmptyArchive
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
          />
        ) : (
          <>
            <div
              className="
                grid

                grid-cols-2

                items-stretch

                gap-3

                min-[430px]:gap-3.5

                sm:grid-cols-3
                sm:gap-4

                lg:grid-cols-4
                lg:gap-5

                xl:grid-cols-5
              "
            >
              {archive.items.map((book) => (
                <BookArchiveCard key={book.id} book={book} />
              ))}
            </div>

            <Pagination archive={archive} onPatch={patchFilters} />
          </>
        )}
      </main>
    </div>
  );
}
