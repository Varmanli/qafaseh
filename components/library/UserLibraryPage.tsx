"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowDownUp,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Grid,
  Heart,
  List,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";

import EmptyPanelState from "@/components/panel/EmptyPanelState";
import LibraryHeader from "@/components/library/LibraryHeader";
import LibraryBookCard from "@/components/library/LibraryBookCard";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  LibraryBook,
  LibraryByUsernameResult,
} from "@/lib/library/service";

type PublicLibraryResult = Extract<
  LibraryByUsernameResult,
  { found: true; isPrivate: false }
>;

type FilterKey =
  | "ALL"
  | "READING"
  | "PAUSED"
  | "STOPPED"
  | "FINISHED"
  | "UNREAD"
  | "FAVORITES";
type SortKey = "NEWEST" | "TITLE" | "RATING";
type ViewMode = "grid" | "list";

const DEFAULT_VIEW_MODE: ViewMode = "grid";
const LIBRARY_VIEW_MODE_STORAGE_KEY = "ghafaseh:library:view-mode";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "همه" },
  { key: "READING", label: "در حال خواندن" },
  { key: "FINISHED", label: "خوانده‌شده" },
  { key: "STOPPED", label: "متوقف‌شده" },
  { key: "UNREAD", label: "نخوانده" },
  { key: "FAVORITES", label: "علاقه‌مندی‌ها" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "NEWEST", label: "جدیدترین" },
  { key: "TITLE", label: "عنوان" },
  { key: "RATING", label: "امتیاز" },
];

export default function UserLibraryPage({
  initialData,
  initialSearch = "",
  initialFilter,
}: {
  initialData: PublicLibraryResult;
  initialSearch?: string;
  initialFilter?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [books, setBooks] = useState(initialData.books);
  const [query, setQuery] = useState(initialSearch);
  const [filter, setFilter] = useState<FilterKey>(
    (initialFilter?.toUpperCase() as FilterKey) || "ALL",
  );
  const [sortBy, setSortBy] = useState<SortKey>("NEWEST");
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_VIEW_MODE);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moreRef.current && !moreRef.current.contains(target)) {
        setMoreOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(target)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    try {
      const storedViewMode = localStorage.getItem(LIBRARY_VIEW_MODE_STORAGE_KEY);
      if (storedViewMode === "grid" || storedViewMode === "list") {
        setViewMode(storedViewMode);
      }
    } catch {
      // Storage can be unavailable in restricted browsing contexts.
    }
  }, []);

  const handleViewModeChange = (nextViewMode: ViewMode) => {
    setViewMode(nextViewMode);

    try {
      localStorage.setItem(LIBRARY_VIEW_MODE_STORAGE_KEY, nextViewMode);
    } catch {
      // Keep the selected mode for this session when storage is unavailable.
    }
  };

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const results = books.filter((book) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "FAVORITES" && book.isFavorite) ||
        book.status === filter ||
        // PAUSED is retained for records written before STOPPED was introduced.
        (filter === "STOPPED" && book.status === "PAUSED");

      if (!matchesFilter) return false;
      if (!normalized) return true;

      return [
        book.title,
        book.author,
        book.publisher,
        book.translator,
        book.genre,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });

    return results.sort((left, right) => {
      if (sortBy === "TITLE") {
        return left.title.localeCompare(right.title, "fa");
      }
      if (sortBy === "RATING") {
        return (right.rating ?? -1) - (left.rating ?? -1);
      }
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });
  }, [books, filter, query, sortBy]);

  const counts = useMemo(
    () => ({
      ALL: books.length,
      READING: books.filter((book) => book.status === "READING").length,
      FINISHED: books.filter((book) => book.status === "FINISHED").length,
      PAUSED: books.filter((book) => book.status === "PAUSED").length,
      STOPPED: books.filter((book) => ["PAUSED", "STOPPED"].includes(book.status)).length,
      UNREAD: books.filter((book) => book.status === "UNREAD").length,
      FAVORITES: books.filter((book) => book.isFavorite).length,
    }),
    [books],
  );

  const handleCycleStatus = async (book: LibraryBook) => {
    // Keep to satisfy prop signature, but not bound to primary card button anymore
    const nextStatusMap = {
      UNREAD: "READING",
      READING: "FINISHED",
      PAUSED: "READING",
      STOPPED: "READING",
      FINISHED: "UNREAD",
    } as const;
    const status = nextStatusMap[book.status] || "UNREAD";
    setPendingId(book.id);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "تغییر وضعیت ناموفق بود");
        return;
      }

      setBooks((current) =>
        current.map((item) =>
          item.id === book.id ? { ...item, status } : item,
        ),
      );
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = (book: LibraryBook) => {
    void confirm({
      title: "حذف کتاب",
      description: `کتاب «${book.title}» حذف شود؟ این عملیات قابل بازگشت نیست.`,
      onConfirm: async () => {
        setPendingId(book.id);
        try {
          const res = await fetch(`/api/books/${book.id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || "حذف کتاب ناموفق بود.");
            return;
          }

          setBooks((current) => current.filter((item) => item.id !== book.id));
          toast.success("کتاب حذف شد.");
          router.refresh();
        } catch {
          toast.error("ارتباط با سرور برقرار نشد");
        } finally {
          setPendingId(null);
        }
      },
    });
  };

  const activeFilter =
    FILTERS.find((item) => item.key === filter)?.label || "همه";
  const isMoreActive = ["PAUSED", "STOPPED", "UNREAD", "FAVORITES"].includes(filter);
  const activeMoreLabel = FILTERS.find((item) => item.key === filter)?.label;

  const canReset =
    query.trim() !== "" || filter !== "ALL" || sortBy !== "NEWEST";

  const handleReset = () => {
    setQuery("");
    setFilter("ALL");
    setSortBy("NEWEST");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
      <LibraryHeader
        profile={initialData.profile}
        isOwner={initialData.isOwner}
      />

      {/* Profile Stats */}
      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="group rounded-2xl border border-border/40 bg-card/35 p-3.5 transition-colors hover:bg-card/50 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>

            <div className="min-w-0 text-left" dir="rtl">
              <div className="text-lg font-bold leading-none text-foreground sm:text-xl">
                {initialData.stats.total.toLocaleString("fa-IR")}
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                کل کتاب‌ها
              </div>
            </div>
          </div>
        </div>

        <div className="group rounded-2xl border border-border/40 bg-card/35 p-3.5 transition-colors hover:bg-card/50 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <Clock3 className="h-4 w-4" />
            </div>

            <div className="min-w-0 text-left" dir="rtl">
              <div className="text-lg font-bold leading-none text-foreground sm:text-xl">
                {initialData.stats.reading.toLocaleString("fa-IR")}
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                در حال خواندن
              </div>
            </div>
          </div>
        </div>

        <div className="group rounded-2xl border border-border/40 bg-card/35 p-3.5 transition-colors hover:bg-card/50 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>

            <div className="min-w-0 text-left" dir="rtl">
              <div className="text-lg font-bold leading-none text-foreground sm:text-xl">
                {initialData.stats.finished.toLocaleString("fa-IR")}
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                خوانده‌شده
              </div>
            </div>
          </div>
        </div>

        <div className="group rounded-2xl border border-border/40 bg-card/35 p-3.5 transition-colors hover:bg-card/50 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <Heart className="h-4 w-4" />
            </div>

            <div className="min-w-0 text-left" dir="rtl">
              <div className="text-lg font-bold leading-none text-foreground sm:text-xl">
                {initialData.stats.favorites.toLocaleString("fa-IR")}
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                علاقه‌مندی‌ها
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Library Content */}
      <div className="mt-5 space-y-3.5">
        {/* Coherent Library Toolbar */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />

            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو در کتابخانه..."
              className="
        h-11 w-full rounded-xl
        border border-border/30
        bg-card/25
        pr-10 pl-3
        text-xs
        placeholder:text-muted-foreground/50
        transition-colors
        hover:bg-card/35
        focus-visible:border-primary/30
        focus-visible:ring-2
        focus-visible:ring-primary/10
      "
            />
          </div>

          {/* Filters / Sort / View */}
          <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="فیلتر و مرتب‌سازی"
                className={cn(
                  `
            relative flex h-11 w-11 shrink-0
            items-center justify-center
            rounded-xl border
            transition-all
          `,
                  canReset
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border/30 bg-card/25 text-muted-foreground hover:bg-card/40 hover:text-foreground",
                )}
              >
                <SlidersHorizontal className="h-[18px] w-[18px]" />

                {/* Active indicator */}
                {canReset && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
                )}
              </button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="
        w-3/4
        overflow-y-auto
        border-r border-border/50
        bg-background
        px-4
        pb-6
        pt-3
        sm:max-w-lg
      "
            >
              <SheetHeader className="text-right">
                <SheetTitle className="text-base font-bold">
                  نمایش کتاب‌ها
                </SheetTitle>

                <SheetDescription className="text-xs leading-5 text-muted-foreground">
                  فیلتر، ترتیب و نحوه نمایش کتابخانه را تنظیم کنید.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-7" dir="rtl">
                {/* Status */}
                <section>
                  <div className="mb-3 text-xs font-semibold text-foreground">
                    وضعیت مطالعه
                  </div>

                  <div className="space-y-1">
                    {FILTERS.map((item) => {
                      const active = filter === item.key;

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFilter(item.key)}
                          className={cn(
                            `
                      flex min-h-12 w-full
                      items-center justify-between
                      rounded-xl px-3
                      transition-colors
                    `,
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-foreground/5",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Radio */}
                            <span
                              className={cn(
                                `
                          flex h-5 w-5 shrink-0
                          items-center justify-center
                          rounded-full border
                        `,
                                active
                                  ? "border-primary bg-primary"
                                  : "border-border",
                              )}
                            >
                              {active && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </span>

                            <span
                              className={cn(
                                "text-sm",
                                active && "font-semibold",
                              )}
                            >
                              {item.label}
                            </span>
                          </div>

                          <span className="text-xs tabular-nums text-muted-foreground">
                            {counts[item.key].toLocaleString("fa-IR")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className="h-px bg-border/40" />

                {/* Sort */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <ArrowDownUp className="h-4 w-4 text-muted-foreground" />

                    <span className="text-xs font-semibold text-foreground">
                      مرتب‌سازی
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {SORTS.map((item) => {
                      const active = sortBy === item.key;

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setSortBy(item.key)}
                          className={cn(
                            `
                      flex h-11 items-center justify-center
                      rounded-xl border
                      text-xs font-medium
                      transition-colors
                    `,
                            active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/40 bg-card/20 text-muted-foreground hover:bg-card/40 hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className="h-px bg-border/40" />

                {/* View Mode */}
                <section>
                  <div className="mb-3 text-xs font-semibold text-foreground">
                    نحوه نمایش
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewModeChange("grid")}
                      className={cn(
                        `
                  flex h-12 items-center justify-center gap-2
                  rounded-xl border
                  text-xs font-medium
                  transition-colors
                `,
                        viewMode === "grid"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/40 bg-card/20 text-muted-foreground",
                      )}
                    >
                      <Grid className="h-4 w-4" />
                      شبکه‌ای
                      {viewMode === "grid" && <Check className="h-3.5 w-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleViewModeChange("list")}
                      className={cn(
                        `
                  flex h-12 items-center justify-center gap-2
                  rounded-xl border
                  text-xs font-medium
                  transition-colors
                `,
                        viewMode === "list"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/40 bg-card/20 text-muted-foreground",
                      )}
                    >
                      <List className="h-4 w-4" />
                      لیستی
                      {viewMode === "list" && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </section>

                {/* Footer actions */}
                <div className="flex gap-2 pt-1">
                  {canReset && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      className="h-11 flex-1 rounded-xl text-xs"
                    >
                      پاک کردن فیلترها
                    </Button>
                  )}

                  <Button
                    type="button"
                    onClick={() => setFiltersSheetOpen(false)}
                    className="h-11 flex-[1.4] rounded-xl text-xs font-semibold"
                  >
                    مشاهده کتاب‌ها
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {/* Book List Grid/List Content */}
        <div className="min-h-[250px] relative">
          {filteredBooks.length === 0 ? (
            <EmptyState
              isOwner={initialData.isOwner}
              hasQuery={!!query.trim()}
              activeFilterLabel={activeFilter}
            />
          ) : (
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "flex flex-col gap-2.5",
              )}
            >
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className={cn(
                    pendingId === book.id
                      ? "pointer-events-none opacity-60"
                      : "",
                    viewMode === "list" && "w-full",
                  )}
                >
                  <LibraryBookCard
                    book={book}
                    canManage={initialData.isOwner}
                    onCycleStatus={handleCycleStatus}
                    onDelete={handleDelete}
                    viewMode={viewMode}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  isOwner,
  hasQuery,
  activeFilterLabel,
}: {
  isOwner: boolean;
  hasQuery: boolean;
  activeFilterLabel: string;
}) {
  if (hasQuery) {
    return (
      <EmptyPanelState
        title="نتیجه‌ای پیدا نشد"
        description={`در فیلتر «${activeFilterLabel}» چیزی با این جست‌وجو پیدا نشد. واژه‌ی دیگری را امتحان کن یا فیلتر را عوض کن.`}
      />
    );
  }

  if (isOwner) {
    return (
      <EmptyPanelState
        title={`بخش «${activeFilterLabel}» فعلاً خالی است`}
        description="وقتی کتابی را به این وضعیت ببری، اینجا دیده می‌شود."
        ctaLabel="افزودن کتاب"
        ctaHref="/books/add"
      />
    );
  }

  return (
    <EmptyPanelState
      title={`در بخش «${activeFilterLabel}» چیزی برای نمایش نیست`}
      description="این کاربر هنوز کتاب عمومی‌ای در این بخش ندارد."
    />
  );
}
