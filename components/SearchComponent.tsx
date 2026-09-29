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
  ChevronLeft,
  Loader2,
  Search,
} from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";
import AuthorAvatar from "@/components/reference/AuthorAvatar";
import UserSearchResult from "@/components/search/UserSearchResult";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PublicUserSearchResult } from "@/lib/search/user-search";
import { getProfilePath } from "@/lib/library/paths";

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
  publishers: GlobalSearchReference[];
  magazine: GlobalSearchMagazine[];
  users: PublicUserSearchResult[];
  hasMore: Record<SearchSectionKey, boolean>;
}

interface GlobalSearchMagazine {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
}

interface SearchComponentProps {
  className?: string;
  onboardingTarget?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  resultsHref?: string;
  initialQuery?: string;
  initialTab?: "books" | "users";
  fullUsers?: { items: PublicUserSearchResult[]; total: number; page: number; pageCount: number };
  variant?: "header" | "dialog" | "page";
}

type SearchSectionKey = "books" | "authors" | "publishers" | "magazine" | "users";

type NavigableItem = {
  key: string;
  sectionKey: SearchSectionKey;
  item: GlobalSearchBook | GlobalSearchReference | GlobalSearchMagazine | PublicUserSearchResult;
};

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY = 280;
const CACHE_LIMIT = 12;

const EMPTY_RESULTS: GlobalSearchResponse = {
  books: [],
  authors: [],
  publishers: [],
  magazine: [],
  users: [],
  hasMore: { books: false, authors: false, publishers: false, magazine: false, users: false },
};

const SearchComponent = memo(function SearchComponent({
  className = "",
  onboardingTarget,
  placeholder = "جست‌وجو در قفسه...",
  onSearch,
  resultsHref = "/books",
  initialQuery = "",
  initialTab = "books",
  fullUsers,
  variant = "header",
}: SearchComponentProps) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GlobalSearchResponse>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<SearchSectionKey>(initialTab);

  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, GlobalSearchResponse>>(new Map());

  const searchId = useId();
  const inputId = `${searchId}-input`;
  const dropdownId = `${searchId}-results`;

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const showFullUsers = variant === "page" && initialTab === "users" && trimmedQuery === initialQuery.trim() && fullUsers;

  const sections = useMemo(
    () => [
      {
        key: "books" as const,
        title: "کتاب‌ها",
        allLabel: "مشاهده همه کتاب‌ها",
        allHref: `${resultsHref}?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.books,
      },
      {
        key: "authors" as const,
        title: "پدیدآورها",
        allLabel: "مشاهده همه پدیدآورها",
        allHref: `/authors?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.authors,
      },
      {
        key: "publishers" as const,
        title: "ناشرها",
        allLabel: "مشاهده همه ناشرها",
        allHref: `/publishers?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.publishers,
      },
      {
        key: "magazine" as const,
        title: "مجله",
        allLabel: "مشاهده همه مطالب مجله",
        allHref: `/blog?q=${encodeURIComponent(trimmedQuery)}`,
        items: results.magazine,
      },
      {
        key: "users" as const,
        title: "کاربران",
        allLabel: "مشاهده همه کاربران",
        allHref: `/search?q=${encodeURIComponent(trimmedQuery)}&tab=users`,
        items: showFullUsers ? fullUsers.items : results.users,
      },
    ],
    [results, resultsHref, trimmedQuery, showFullUsers, fullUsers],
  );

  const activeSection = sections.find((section) => section.key === activeTab) ?? sections[0];

  const totalResults = useMemo(
    () =>
      results.books.length +
      results.authors.length +
      results.publishers.length +
      results.magazine.length +
      results.users.length,
    [results],
  );

  const navigableItems = useMemo<NavigableItem[]>(
    () =>
      activeSection.items.map((item) => ({
        key: `${activeSection.key}-${activeSection.key === "users" ? (item as PublicUserSearchResult).username : (item as GlobalSearchBook).id}`,
        sectionKey: activeSection.key,
        item,
      })),
    [activeSection],
  );

  const itemIndexMap = useMemo(() => {
    const map = new Map<string, number>();

    navigableItems.forEach((entry, index) => {
      map.set(entry.key, index);
    });

    return map;
  }, [navigableItems]);

  const selectTab = (tab: SearchSectionKey) => {
    setActiveTab(tab);
    setSelectedIndex(-1);
  };

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

  const submitQuery = () => {
    if (!trimmedQuery) return;
    onSearch?.(trimmedQuery);
    if (variant === "page") {
      router.replace(`/search?q=${encodeURIComponent(trimmedQuery)}${initialTab === "users" ? "&tab=users" : ""}`, { scroll: false });
      return;
    }
    handleNavigate(`${resultsHref}?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuery();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setQuery(value);
    setActiveTab("books");
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
        submitQuery();
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
    setQuery(initialQuery);
    setActiveTab(initialTab);
    setSelectedIndex(-1);
    setHasError(false);
    if (initialQuery.trim().length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_RESULTS);
      setShowDropdown(false);
    } else {
      setShowDropdown(true);
    }
  }, [initialQuery, initialTab]);

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    if (variant === "page") {
      setShowDropdown(true);
      setIsLoading(true);
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
          `/api/search/global?q=${encodeURIComponent(trimmedQuery)}&limit=${variant === "page" ? 5 : 4}`,
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
  }, [canSearch, trimmedQuery, variant]);

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
      className={cn(variant === "dialog" ? "w-full" : "relative w-full", className)}
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
            h-12 w-full rounded-2xl
            border-border/60
            bg-background/65
            pr-4 pl-12
            text-[13px] font-medium text-foreground
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

            data-[search-variant=dialog]:h-14
            data-[search-variant=dialog]:rounded-2xl
            data-[search-variant=dialog]:text-[15px]
            data-[search-variant=page]:h-14
            data-[search-variant=page]:rounded-xl
            data-[search-variant=page]:text-sm
          "
          aria-label="جست‌وجوی سراسری در قفسه"
          aria-expanded={showDropdown && canSearch}
          aria-controls={dropdownId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          data-search-variant={variant}
        />

        <Button
          type="submit"
          size="icon"
          aria-label="جست‌وجو"
          disabled={!trimmedQuery || isLoading}
          className="
            absolute left-1.5 top-1/2
            size-9 -translate-y-1/2
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
          className={cn(
            `
            ${variant === "dialog" ? "mt-3 max-h-[min(60dvh,32rem)]" : variant === "page" ? "relative mt-4 max-h-none" : "absolute inset-x-0 top-full z-50 mt-2 max-h-[min(34rem,calc(100dvh-7rem))]"}
            rounded-2xl sm:rounded-3xl
            border border-border/60
            bg-popover/95
            p-2
            shadow-[0_24px_70px_-34px_rgba(0,0,0,0.45)]
            backdrop-blur-xl

            [scrollbar-width:thin]

            sm:p-2
          `,
            variant !== "page" && "overflow-y-auto overscroll-contain",
            variant === "page" && "rounded-[1.4rem] border-border/50 bg-card/45 p-1.5 shadow-sm sm:rounded-2xl sm:p-2",
          )}
        >
          {isLoading ? (
            <SearchSkeleton />
          ) : hasError ? (
            <SearchErrorState />
          ) : (
            <>
              {variant !== "page" ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-3.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-muted-foreground">نتایج جست‌وجو</p>
                    <p className="mt-0.5 truncate text-xs font-black text-foreground">«{trimmedQuery}»</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-black text-primary">
                    {totalResults.toLocaleString("fa-IR")}{Object.values(results.hasMore).some(Boolean) ? "+" : ""} نتیجه
                  </span>
                </div>
              ) : null}

              <div
                role="tablist"
                aria-label="دسته‌بندی نتایج جست‌وجو"
                className={cn(
                  "max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  variant === "page"
                    ? "mb-3 grid w-full grid-cols-5 gap-1.5 rounded-2xl bg-muted/35 p-2 sm:mb-0 sm:flex sm:gap-1 sm:overflow-x-auto sm:rounded-none sm:border-b sm:border-border/40 sm:bg-transparent sm:p-0"
                    : "flex gap-1 overflow-x-auto border-b border-border/40 px-1",
                )}
              >
                {sections.map((section) => (
                  <button
                    key={section.key}
                    id={`${dropdownId}-${section.key}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === section.key}
                    aria-controls={`${dropdownId}-panel`}
                    tabIndex={activeTab === section.key ? 0 : -1}
                    onClick={() => selectTab(section.key)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      const next = (sections.findIndex((item) => item.key === section.key) + (event.key === "ArrowLeft" ? 1 : -1) + sections.length) % sections.length;
                      selectTab(sections[next].key);
                      (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2.5 py-2 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:text-xs",
                      variant === "page" && "min-w-0 flex-col gap-1 rounded-xl border-0 px-0.5 py-2.5 text-[10px] leading-4 sm:flex-row sm:gap-1 sm:rounded-none sm:border-b-2 sm:px-2.5 sm:py-2 sm:text-xs",
                      activeTab === section.key
                        ? variant === "page"
                          ? "bg-background text-primary shadow-sm sm:bg-transparent sm:shadow-none sm:border-primary"
                          : "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0 text-center sm:text-right">{section.title}</span>
                  </button>
                ))}
              </div>

              <div id={`${dropdownId}-panel`} role="tabpanel" aria-labelledby={`${dropdownId}-${activeTab}-tab`} className="min-h-16">
                {activeTab === "users" && showFullUsers && fullUsers.total > 0 ? <p className="px-3 pt-3 text-[11px] font-bold text-muted-foreground">{fullUsers.total.toLocaleString("fa-IR")} کاربر</p> : null}
                {activeSection.items.length ? (
                  <SearchSection section={activeSection} compact={variant === "page"} itemIndexMap={itemIndexMap} selectedIndex={selectedIndex} onSelectIndex={setSelectedIndex} onNavigate={handleNavigate} />
                ) : (
                  <p className="px-4 py-7 text-center text-xs text-muted-foreground">
                    {activeTab === "books" ? "کتابی با این عبارت پیدا نشد." : activeTab === "authors" ? "پدیدآوری با این عبارت پیدا نشد." : activeTab === "publishers" ? "ناشری با این عبارت پیدا نشد." : activeTab === "magazine" ? "مطلبی در مجله با این عبارت پیدا نشد." : "کاربری با این نام یا نام کاربری پیدا نشد."}
                  </p>
                )}
                {activeTab === "users" && showFullUsers && fullUsers.pageCount > 1 ? (
                  <nav aria-label="صفحه‌های نتایج کاربران" className="flex items-center justify-center gap-3 border-t border-border/40 px-3 py-3 text-xs">
                    {fullUsers.page > 1 ? <Link href={`/search?q=${encodeURIComponent(trimmedQuery)}&tab=users&page=${fullUsers.page - 1}`} className="text-primary hover:underline">قبلی</Link> : null}
                    <span className="text-muted-foreground">{fullUsers.page.toLocaleString("fa-IR")} از {fullUsers.pageCount.toLocaleString("fa-IR")}</span>
                    {fullUsers.page < fullUsers.pageCount ? <Link href={`/search?q=${encodeURIComponent(trimmedQuery)}&tab=users&page=${fullUsers.page + 1}`} className="text-primary hover:underline">بعدی</Link> : null}
                  </nav>
                ) : null}
              </div>

              {activeTab === "users" && showFullUsers ? null : <div className="mt-1.5 border-t border-border/40 p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleNavigate(activeSection.allHref)}
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
                  <span>{activeSection.allLabel}</span>
                  <ChevronLeft className="size-4" />
                </Button>
              </div>}
            </>
          )}
        </div>
      ) : null}

      {variant === "page" && !canSearch ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border/70 bg-card/35 px-5 py-10 text-center sm:py-12">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Search className="size-5" /></span>
          <p className="mx-auto mt-3 max-w-sm text-xs leading-6 text-muted-foreground">نام کتاب، پدیدآور، ناشر، مطلب مجله یا کاربر را وارد کن.</p>
        </div>
      ) : null}
    </div>
  );
});

function SearchSection({
  section,
  compact = false,
  itemIndexMap,
  selectedIndex,
  onSelectIndex,
  onNavigate,
}: {
  section:
    | {
        key: "books";
        title: string;
        allLabel: string;
        allHref: string;
        items: GlobalSearchBook[];
      }
    | {
        key: "authors" | "publishers";
        title: string;
        allLabel: string;
        allHref: string;
        items: GlobalSearchReference[];
      }
    | {
        key: "magazine";
        title: string;
        allLabel: string;
        allHref: string;
        items: GlobalSearchMagazine[];
      }
    | {
        key: "users";
        title: string;
        allLabel: string;
        allHref: string;
        items: PublicUserSearchResult[];
      };
  compact?: boolean;
  itemIndexMap: Map<string, number>;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onNavigate: (href: string) => void;
}) {
  return (
    <section>
      <div className={cn("p-1.5", compact && "space-y-0 p-0")}>
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
                  onClick={() => onNavigate(getItemHref("books", book))}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-3 rounded-2xl p-2.5 text-right outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20 sm:gap-3.5 sm:p-3.5",
                    compact && "rounded-xl px-2.5 py-2 sm:px-3",
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
          : section.key === "users"
            ? section.items.map((user) => {
                const index = itemIndexMap.get(`users-${user.username}`) ?? -1;
                return (
                  <button key={user.username} type="button" data-search-index={index} onMouseEnter={() => onSelectIndex(index)} onFocus={() => onSelectIndex(index)} onClick={() => onNavigate(getItemHref("users", user))} className={cn("w-full min-w-0 rounded-xl px-3 py-2.5 text-right outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20", selectedIndex === index ? "bg-primary/[0.07]" : "hover:bg-muted/45")}>
                    <UserSearchResult user={user} />
                  </button>
                );
              })
          : section.key === "magazine"
            ? section.items.map((item) => {
                const index = itemIndexMap.get(`magazine-${item.id}`) ?? -1;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-search-index={index}
                    onMouseEnter={() => onSelectIndex(index)}
                    onFocus={() => onSelectIndex(index)}
                    onClick={() => onNavigate(getItemHref("magazine", item))}
                    className={cn(
                      "block w-full min-w-0 rounded-xl px-3 py-2.5 text-right outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20",
                      selectedIndex === index ? "bg-primary/[0.07]" : "hover:bg-muted/45",
                    )}
                  >
                    <span className="block truncate text-xs font-black text-foreground sm:text-sm">{item.title}</span>
                    {item.excerpt ? <span className="mt-1 block truncate text-[11px] text-muted-foreground">{item.excerpt}</span> : null}
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
                    "flex w-full min-w-0 items-center gap-3 rounded-xl p-3 text-right outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20",
                    compact && "px-2.5 py-2",
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
  const matchReason = book.matchedEditionLabel
    ? `نسخهٔ پیدا شده: ${book.matchedEditionLabel}`
    : book.matchedEditionId
      ? "نسخهٔ مرتبط پیدا شد"
      : null;

  return (
    <>
      <div
        className="
          flex h-[84px] w-[58px] shrink-0
          items-center justify-center
          overflow-hidden rounded-lg
          border border-border/30
          bg-muted/50
          shadow-sm

          sm:h-[104px] sm:w-[72px] sm:rounded-xl
        "
      >
        {book.coverImage ? (
          <BookCoverImage
            src={book.coverImage}
            alt={book.title}
            width={72}
            height={104}
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
            text-sm font-black
            leading-6 text-foreground
            sm:text-[15px]
          "
        >
          {book.title}
        </p>

        <p
          className="
            mt-1 line-clamp-1
            text-xs font-semibold
            text-muted-foreground
            sm:text-[13px]
          "
        >
          {book.author}
        </p>

        {matchReason ? (
          <p className="mt-2 inline-flex max-w-full items-center rounded-lg bg-primary/8 px-2 py-1 text-[11px] font-bold text-primary">
            {matchReason}
          </p>
        ) : null}

        {(book.translator || book.publisher) && (
          <div
            className="
            mt-2.5 hidden flex-wrap items-center
            gap-x-2 gap-y-1
            text-[11px] font-medium
              text-muted-foreground/75
            sm:flex sm:text-xs
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
  sectionKey: "authors" | "publishers";
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
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="space-y-2">
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-muted/80" />
        </div>

        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
      </div>

      <div className="flex gap-3 border-b border-border/40 px-3 py-2">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-3 w-14 shrink-0 animate-pulse rounded-full bg-muted" />)}
      </div>
      <div className="space-y-3 px-3 py-4">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted/70" />
      </div>
    </div>
  );
}

function getItemHref(
  sectionKey: SearchSectionKey,
  item: GlobalSearchReference | GlobalSearchBook | GlobalSearchMagazine | PublicUserSearchResult,
) {
  switch (sectionKey) {
    case "authors":
      return `/authors/${encodeURIComponent(
        (item as GlobalSearchReference).slug,
      )}`;

    case "publishers":
      return `/publishers/${encodeURIComponent(
        (item as GlobalSearchReference).slug,
      )}`;

    case "magazine":
      return `/blog/${encodeURIComponent((item as GlobalSearchMagazine).slug)}`;

    case "users":
      return getProfilePath((item as PublicUserSearchResult).username);

    case "books":
    default:
      {
        const book = item as GlobalSearchBook;
        return `/book/${encodeURIComponent(book.slug)}${book.matchedEditionId ? `?edition=${encodeURIComponent(book.matchedEditionId)}` : ""}`;
      }
  }
}

function getReferenceLabel(sectionKey: "authors" | "publishers") {
  switch (sectionKey) {
    case "authors":
      return "نویسنده";


    case "publishers":
      return "ناشر";
  }
}

export default SearchComponent;
