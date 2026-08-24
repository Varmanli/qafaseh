"use client";

import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  ChevronLeft,
  Loader2,
  PenTool,
  Search,
  UserRound,
} from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";
import AuthorAvatar from "@/components/reference/AuthorAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface GlobalSearchBook {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverImage: string | null;
  translator: string | null;
  publisher: string | null;
  matchedEditionId: string | null;
  matchedEditionLabel: string | null;
}

interface GlobalSearchReference {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  bookCount?: number;
}

interface GlobalSearchResponse {
  books: GlobalSearchBook[];
  authors: GlobalSearchReference[];
  translators: GlobalSearchReference[];
  publishers: GlobalSearchReference[];
}

interface SearchComponentProps {
  className?: string;
  onboardingTarget?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  resultsHref?: string;
}

type SearchSectionKey = "books" | "authors" | "translators" | "publishers";

type NavigableItem = {
  key: string;
  sectionKey: SearchSectionKey;
  item: GlobalSearchBook | GlobalSearchReference;
};

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY = 280;
const CACHE_LIMIT = 12;

const EMPTY_RESULTS: GlobalSearchResponse = {
  books: [],
  authors: [],
  translators: [],
  publishers: [],
};

const SearchComponent = memo(function SearchComponent({
  className = "",
  onboardingTarget,
  placeholder = "جست‌وجو در قفسه...",
  onSearch,
  resultsHref = "/books",
}: SearchComponentProps) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResponse>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, GlobalSearchResponse>>(new Map());

  const searchId = useId();
  const inputId = `${searchId}-input`;
  const dropdownId = `${searchId}-results`;

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const sections = useMemo(
    () => [
      {
        key: "books" as const,
        title: "کتاب‌ها",
        icon: BookOpen,
        allHref: `${resultsHref}?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.books,
      },
      {
        key: "authors" as const,
        title: "نویسنده‌ها",
        icon: PenTool,
        allHref: `/authors?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.authors,
      },
      {
        key: "translators" as const,
        title: "مترجم‌ها",
        icon: UserRound,
        allHref: `/translators?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.translators,
      },
      {
        key: "publishers" as const,
        title: "ناشرها",
        icon: Building2,
        allHref: `/publishers?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.publishers,
      },
    ],
    [results, resultsHref, trimmedQuery],
  );

  const nonEmptySections = useMemo(
    () => sections.filter((section) => section.items.length > 0),
    [sections],
  );

  const navigableItems = useMemo<NavigableItem[]>(
    () =>
      nonEmptySections.flatMap((section) =>
        section.items.map((item) => ({
          key: `${section.key}-${item.id}`,
          sectionKey: section.key,
          item,
        })),
      ),
    [nonEmptySections],
  );

  const itemIndexMap = useMemo(() => {
    const map = new Map<string, number>();

    navigableItems.forEach((entry, index) => {
      map.set(entry.key, index);
    });

    return map;
  }, [navigableItems]);

  const totalResults = useMemo(
    () =>
      results.books.length +
      results.authors.length +
      results.translators.length +
      results.publishers.length,
    [results],
  );

  const hasAnyResult = totalResults > 0;

  const closeDropdown = () => {
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const resetSearch = () => {
    setQuery("");
    setResults(EMPTY_RESULTS);
    setIsLoading(false);
    setHasError(false);
    closeDropdown();
  };

  const handleNavigate = (href: string) => {
    router.push(href);
    resetSearch();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedQuery) {
      return;
    }

    onSearch?.(trimmedQuery);
    handleNavigate(`${resultsHref}?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setQuery(value);
    setSelectedIndex(-1);
    setHasError(false);

    const nextQuery = value.trim();

    if (nextQuery.length >= MIN_QUERY_LENGTH) {
      setShowDropdown(true);
      setIsLoading(true);
      return;
    }

    setIsLoading(false);
    setResults(EMPTY_RESULTS);
    setShowDropdown(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      closeDropdown();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (showDropdown && selectedIndex >= 0 && navigableItems[selectedIndex]) {
        const selected = navigableItems[selectedIndex];

        handleNavigate(getItemHref(selected.sectionKey, selected.item));
        return;
      }

      if (trimmedQuery) {
        onSearch?.(trimmedQuery);
        handleNavigate(`${resultsHref}?q=${encodeURIComponent(trimmedQuery)}`);
      }

      return;
    }

    if (!showDropdown || navigableItems.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setSelectedIndex((current) =>
        current < navigableItems.length - 1 ? current + 1 : 0,
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setSelectedIndex((current) =>
        current > 0 ? current - 1 : navigableItems.length - 1,
      );
    }
  };

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const normalizedQuery = trimmedQuery.toLocaleLowerCase("fa-IR");
    const cached = cacheRef.current.get(normalizedQuery);

    if (cached) {
      setResults(cached);
      setIsLoading(false);
      setHasError(false);
      setShowDropdown(true);
      return;
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setHasError(false);
      setShowDropdown(true);

      try {
        const response = await fetch(
          `/api/search/global?q=${encodeURIComponent(trimmedQuery)}&limit=4`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const data: GlobalSearchResponse = await response.json();

        cacheRef.current.set(normalizedQuery, data);

        if (cacheRef.current.size > CACHE_LIMIT) {
          const oldestKey = cacheRef.current.keys().next().value;

          if (oldestKey) {
            cacheRef.current.delete(oldestKey);
          }
        }

        setResults(data);
        setHasError(false);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Global search error:", error);
        setResults(EMPTY_RESULTS);
        setHasError(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, SEARCH_DELAY);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [canSearch, trimmedQuery]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (rootRef.current && !rootRef.current.contains(target)) {
        closeDropdown();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }

    const selectedElement = dropdownRef.current?.querySelector(
      `[data-search-index="${selectedIndex}"]`,
    );

    selectedElement?.scrollIntoView({
      block: "nearest",
    });
  }, [selectedIndex]);

  return (
    <div
      ref={rootRef}
      data-onboarding={onboardingTarget}
      className={cn("relative w-full", className)}
    >
      <form
        onSubmit={handleSubmit}
        className="
          group relative w-full
          rounded-2xl
        "
        role="search"
      >
        <Input
          id={inputId}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (canSearch) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          className="
            h-11 w-full rounded-2xl
            border-border/60
            bg-background/65
            pr-4 pl-12
            text-sm text-foreground
            shadow-sm shadow-black/[0.03]
            backdrop-blur-md
            transition-all duration-200

            placeholder:text-muted-foreground/60

            hover:border-border/90
            hover:bg-background/80

            focus-visible:border-primary/40
            focus-visible:bg-background
            focus-visible:ring-2
            focus-visible:ring-primary/15

            sm:h-12 sm:rounded-[1.15rem]
          "
          aria-label="جست‌وجوی سراسری در قفسه"
          aria-expanded={showDropdown && canSearch}
          aria-controls={dropdownId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
        />

        <Button
          type="submit"
          size="icon"
          aria-label="جست‌وجو"
          disabled={!trimmedQuery || isLoading}
          className="
            absolute left-1.5 top-1/2
            size-8 -translate-y-1/2
            rounded-xl
            shadow-none
            transition-all duration-200

            enabled:hover:scale-[1.03]
            enabled:active:scale-95

            sm:size-9
          "
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </Button>
      </form>

      {showDropdown && canSearch ? (
        <div
          id={dropdownId}
          ref={dropdownRef}
          className="
            absolute inset-x-0 top-full z-50
            mt-2
            max-h-[min(34rem,calc(100dvh-7rem))]
            overflow-y-auto overscroll-contain
            rounded-2xl
            border border-border/60
            bg-popover/95
            p-1.5
            shadow-[0_24px_70px_-34px_rgba(0,0,0,0.45)]
            backdrop-blur-xl

            [scrollbar-width:thin]

            sm:mt-2.5
            sm:rounded-3xl
            sm:p-2
          "
        >
          {isLoading ? (
            <SearchSkeleton />
          ) : hasError ? (
            <SearchErrorState />
          ) : hasAnyResult ? (
            <>
              <div
                className="
                  flex items-center justify-between
                  gap-3 px-3 py-2.5
                  sm:px-3.5
                "
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-muted-foreground">
                    نتایج جست‌وجو
                  </p>

                  <p className="mt-0.5 truncate text-xs font-black text-foreground">
                    «{trimmedQuery}»
                  </p>
                </div>

                <span
                  className="
                    shrink-0 rounded-full
                    bg-primary/8
                    px-2.5 py-1
                    text-[10px] font-black
                    text-primary
                  "
                >
                  {totalResults.toLocaleString("fa-IR")} نتیجه
                </span>
              </div>

              <div className="space-y-1.5">
                {nonEmptySections.map((section) => (
                  <SearchSection
                    key={section.key}
                    section={section}
                    itemIndexMap={itemIndexMap}
                    selectedIndex={selectedIndex}
                    onSelectIndex={setSelectedIndex}
                    onNavigate={handleNavigate}
                    onViewAll={resetSearch}
                  />
                ))}
              </div>

              <div className="mt-1.5 border-t border-border/40 p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    handleNavigate(
                      `${resultsHref}?q=${encodeURIComponent(trimmedQuery)}`,
                    )
                  }
                  className="
                    h-10 w-full justify-between
                    rounded-xl px-3
                    text-xs font-bold
                    text-muted-foreground
                    transition-colors

                    hover:bg-primary/5
                    hover:text-primary
                  "
                >
                  <span>مشاهده همه نتایج</span>
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <SearchEmptyState query={trimmedQuery} />
          )}
        </div>
      ) : null}
    </div>
  );
});

function SearchSection({
  section,
  itemIndexMap,
  selectedIndex,
  onSelectIndex,
  onNavigate,
  onViewAll,
}: {
  section:
    | {
        key: "books";
        title: string;
        icon: typeof BookOpen;
        allHref: string;
        items: GlobalSearchBook[];
      }
    | {
        key: Exclude<SearchSectionKey, "books">;
        title: string;
        icon: typeof PenTool;
        allHref: string;
        items: GlobalSearchReference[];
      };
  itemIndexMap: Map<string, number>;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onNavigate: (href: string) => void;
  onViewAll: () => void;
}) {
  const Icon = section.icon;

  return (
    <section
      className="
        overflow-hidden rounded-2xl
        border border-border/45
        bg-background/30
      "
    >
      <header
        className="
          flex items-center justify-between
          gap-3 border-b border-border/35
          px-3 py-2.5
        "
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="
              flex size-7 shrink-0
              items-center justify-center
              rounded-lg bg-primary/8
              text-primary
            "
          >
            <Icon className="size-3.5" />
          </span>

          <h2 className="truncate text-xs font-black text-foreground">
            {section.title}
          </h2>
        </div>

        <Link
          href={section.allHref}
          onClick={onViewAll}
          className="
            inline-flex shrink-0 items-center
            gap-0.5 rounded-lg
            px-1.5 py-1
            text-[10px] font-bold
            text-muted-foreground
            transition-colors

            hover:text-primary
          "
        >
          مشاهده همه
          <ChevronLeft className="size-3" />
        </Link>
      </header>

      <div className="p-1.5">
        {section.key === "books"
          ? section.items.map((book) => {
              const index = itemIndexMap.get(`books-${book.id}`) ?? -1;
              const selected = selectedIndex === index;

              return (
                <button
                  key={book.id}
                  type="button"
                  data-search-index={index}
                  onMouseEnter={() => onSelectIndex(index)}
                  onFocus={() => onSelectIndex(index)}
                  onClick={() =>
                    onNavigate(`/book/${encodeURIComponent(book.slug)}`)
                  }
                  className={cn(
                    `
                      flex w-full min-w-0 items-start gap-3
                      rounded-xl p-2.5 text-right
                      outline-none
                      transition-all duration-150

                      focus-visible:ring-2
                      focus-visible:ring-primary/20

                      sm:p-3
                    `,
                    selected
                      ? `
                        bg-primary/[0.07]
                        ring-1 ring-primary/10
                      `
                      : `
                        hover:bg-muted/45
                      `,
                  )}
                >
                  <BookResultCard book={book} />
                </button>
              );
            })
          : section.items.map((item) => {
              const index = itemIndexMap.get(`${section.key}-${item.id}`) ?? -1;
              const selected = selectedIndex === index;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-search-index={index}
                  onMouseEnter={() => onSelectIndex(index)}
                  onFocus={() => onSelectIndex(index)}
                  onClick={() => onNavigate(getItemHref(section.key, item))}
                  className={cn(
                    `
                      flex w-full min-w-0 items-center gap-3
                      rounded-xl p-2.5 text-right
                      outline-none
                      transition-all duration-150

                      focus-visible:ring-2
                      focus-visible:ring-primary/20
                    `,
                    selected
                      ? `
                        bg-primary/[0.07]
                        ring-1 ring-primary/10
                      `
                      : `
                        hover:bg-muted/45
                      `,
                  )}
                >
                  <ReferenceResultCard item={item} sectionKey={section.key} />
                </button>
              );
            })}
      </div>
    </section>
  );
}

function BookResultCard({ book }: { book: GlobalSearchBook }) {
  return (
    <>
      <div
        className="
          flex h-[72px] w-[50px] shrink-0
          items-center justify-center
          overflow-hidden rounded-lg
          border border-border/30
          bg-muted/50
          shadow-sm

          sm:h-20 sm:w-14 sm:rounded-xl
        "
      >
        {book.coverImage ? (
          <BookCoverImage
            src={book.coverImage}
            alt={book.title}
            width={56}
            height={80}
            className="h-full w-full object-cover"
          />
        ) : (
          <BookOpen className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <p
          className="
            line-clamp-1
            text-xs font-black
            leading-5 text-foreground
            sm:text-sm
          "
        >
          {book.title}
        </p>

        <p
          className="
            mt-0.5 line-clamp-1
            text-[11px] font-medium
            text-muted-foreground
            sm:mt-1 sm:text-xs
          "
        >
          {book.author}
        </p>

        {book.matchedEditionLabel ? (
          <p className="mt-1 line-clamp-1 text-[10px] font-semibold text-primary/80 sm:text-[11px]">
            نسخهٔ یافت‌شده: {book.matchedEditionLabel}
          </p>
        ) : null}

        {(book.translator || book.publisher) && (
          <div
            className="
              mt-2 flex flex-wrap items-center
              gap-x-2.5 gap-y-1
              text-[9px] font-medium
              text-muted-foreground/75
              sm:text-[10px]
            "
          >
            {book.translator ? (
              <span className="max-w-full truncate">
                مترجم: {book.translator}
              </span>
            ) : null}

            {book.publisher ? (
              <span className="max-w-full truncate">
                ناشر: {book.publisher}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

function ReferenceResultCard({
  item,
  sectionKey,
}: {
  item: GlobalSearchReference;
  sectionKey: Exclude<SearchSectionKey, "books">;
}) {
  return (
    <>
      <AuthorAvatar
        name={item.name}
        image={item.image}
        sizeClassName="h-11 w-11 sm:h-12 sm:w-12"
        textClassName="text-base sm:text-lg"
        iconClassName="h-4 w-4 sm:h-5 sm:w-5"
      />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-black text-foreground sm:text-sm">
          {item.name}
        </p>

        {sectionKey === "authors" && typeof item.bookCount === "number" ? (
          <p className="mt-1 text-[10px] font-medium text-muted-foreground sm:text-xs">
            {item.bookCount.toLocaleString("fa-IR")} کتاب
          </p>
        ) : (
          <p className="mt-1 text-[10px] font-medium text-muted-foreground sm:text-xs">
            {getReferenceLabel(sectionKey)}
          </p>
        )}
      </div>

      <ChevronLeft className="size-4 shrink-0 text-muted-foreground/45" />
    </>
  );
}

function SearchEmptyState({ query }: { query: string }) {
  return (
    <div
      className="
        flex flex-col items-center
        px-5 py-9 text-center
        sm:py-10
      "
    >
      <span
        className="
          flex size-11 items-center
          justify-center rounded-2xl
          bg-muted/50
          text-muted-foreground
        "
      >
        <Search className="size-5" />
      </span>

      <p className="mt-3 text-sm font-black text-foreground">
        نتیجه‌ای پیدا نشد
      </p>

      <p className="mt-1 max-w-xs text-[11px] leading-5 text-muted-foreground">
        برای «{query}» چیزی پیدا نکردیم. عبارت کوتاه‌تر یا کلمات دیگری را امتحان
        کن.
      </p>
    </div>
  );
}

function SearchErrorState() {
  return (
    <div
      className="
        flex flex-col items-center
        px-5 py-9 text-center
        sm:py-10
      "
    >
      <span
        className="
          flex size-11 items-center
          justify-center rounded-2xl
          bg-destructive/10
          text-destructive
        "
      >
        <Search className="size-5" />
      </span>

      <p className="mt-3 text-sm font-black text-foreground">
        جست‌وجو انجام نشد
      </p>

      <p className="mt-1 max-w-xs text-[11px] leading-5 text-muted-foreground">
        مشکلی در دریافت نتایج پیش آمد. چند لحظه دیگر دوباره امتحان کن.
      </p>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="space-y-2">
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-muted/80" />
        </div>

        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
      </div>

      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <div
          key={sectionIndex}
          className="
            overflow-hidden rounded-2xl
            border border-border/40
            bg-background/30
          "
        >
          <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2.5">
            <div className="size-7 animate-pulse rounded-lg bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
          </div>

          <div className="space-y-1 p-1.5">
            {Array.from({ length: 2 }).map((__, itemIndex) => (
              <div
                key={itemIndex}
                className="flex items-center gap-3 rounded-xl p-2.5"
              >
                <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getItemHref(
  sectionKey: SearchSectionKey,
  item: GlobalSearchReference | GlobalSearchBook,
) {
  switch (sectionKey) {
    case "authors":
      return `/authors/${encodeURIComponent(
        (item as GlobalSearchReference).slug,
      )}`;

    case "translators":
      return `/translators/${encodeURIComponent(
        (item as GlobalSearchReference).slug,
      )}`;

    case "publishers":
      return `/publishers/${encodeURIComponent(
        (item as GlobalSearchReference).slug,
      )}`;

    case "books":
    default:
      {
        const book = item as GlobalSearchBook;
        return `/book/${encodeURIComponent(book.slug)}${book.matchedEditionId ? `?edition=${encodeURIComponent(book.matchedEditionId)}` : ""}`;
      }
  }
}

function getReferenceLabel(sectionKey: Exclude<SearchSectionKey, "books">) {
  switch (sectionKey) {
    case "authors":
      return "نویسنده";

    case "translators":
      return "مترجم";

    case "publishers":
      return "ناشر";
  }
}

export default SearchComponent;
