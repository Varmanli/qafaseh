"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  LibraryBig,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/common/ConfirmDialog";
import BookCoverImage from "@/components/books/BookCoverImage";
import type { CatalogResult } from "@/components/catalog/types";

type Priority = "HIGH" | "MEDIUM" | "LOW";
type Item = {
  id: string;
  title: string;
  author: string;
  catalogBookId: string | null;
  priority: Priority;
  publisher: string | null;
  translator: string | null;
  genre: string | null;
  note: string | null;
  coverImage: string | null;
};
const priorities: { value: Priority; label: string }[] = [
  { value: "HIGH", label: "بالا" },
  { value: "MEDIUM", label: "متوسط" },
  { value: "LOW", label: "پایین" },
];

export default function WishlistPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState<Item | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selected, setSelected] = useState<CatalogResult | null>(null);
  const [priority, setPriority] = useState<Priority | "">("");
  const [activeFilter, setActiveFilter] = useState<Priority | "ALL">("ALL");
  const [filterQuery, setFilterQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(
        "/api/wishlist?sortBy=priority&sortOrder=asc",
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      setItems((await response.json()).wishlist);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        setResults((await response.json()).results ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setResults([]);
        setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function startSearch() {
    setQuery("");
    setResults([]);
    setSelected(null);
    setPriority("");
    setSearchError(false);
    setOpen(true);
  }

  async function addSelected() {
    if (!selected || !priority) return;
    setBusyId("create");
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogBookId: selected.id, priority }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "افزودن ناموفق بود");
      setOpen(false);
      toast.success("کتاب به لیست خرید اضافه شد");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "افزودن ناموفق بود");
    } finally {
      setBusyId(null);
    }
  }

  async function changePriority(item: Item, nextPriority: Priority) {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/wishlist/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: nextPriority }),
      });
      if (!response.ok) throw new Error();
      await refresh();
    } catch {
      toast.error("تغییر اولویت ناموفق بود");
    } finally {
      setBusyId(null);
    }
  }

  function remove(item: Item) {
    void confirm({
      title: "حذف از لیست خرید",
      description: `«${item.title}» حذف شود؟`,
      onConfirm: async () => {
        setBusyId(item.id);
        try {
          const response = await fetch(`/api/wishlist/${item.id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error();
          toast.success("کتاب حذف شد");
          await refresh();
        } catch {
          toast.error("حذف ناموفق بود");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  async function buy(addToLibrary: boolean) {
    if (!buying) return;
    setBusyId(buying.id);
    try {
      const response = await fetch(`/api/wishlist/${buying.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addToLibrary }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ثبت خرید ناموفق بود");
      setBuying(null);
      toast.success(
        addToLibrary
          ? "خرید ثبت شد و کتاب به کتابخانه‌ات اضافه شد"
          : "خرید ثبت شد",
      );
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ثبت خرید ناموفق بود",
      );
    } finally {
      setBusyId(null);
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesPriority =
      activeFilter === "ALL" || item.priority === activeFilter;
    const normalizedQuery = filterQuery.trim().toLocaleLowerCase("fa-IR");
    const matchesQuery =
      !normalizedQuery ||
      [
        item.title,
        item.author,
        item.publisher,
        item.translator,
        item.genre,
      ].some((value) =>
        value?.toLocaleLowerCase("fa-IR").includes(normalizedQuery),
      );
    return matchesPriority && matchesQuery;
  });
  const priorityCount = (value: Priority) =>
    items.filter((item) => item.priority === value).length;
  const priorityTone: Record<Priority, string> = {
    HIGH: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    MEDIUM:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    LOW: "border-primary/20 bg-primary/10 text-primary",
  };
  return (
    <main
      dir="rtl"
      className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-12 pt-5 sm:space-y-6 sm:px-6 sm:pb-16 sm:pt-9"
    >
      <header className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-6">
        <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-12 sm:rounded-2xl">
            <LibraryBig className="size-5 sm:size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              لیست خرید
            </h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
              کتاب‌هایی که می‌خواهی بخری و به قفسه‌ات اضافه کنی.
            </p>
          </div>
        </div>
        <Button
          onClick={startSearch}
          className="h-10 w-full rounded-xl px-4 sm:w-auto sm:shrink-0"
        >
          <Plus className="size-4" /> افزودن کتاب
        </Button>
      </header>

      {loading ? (
        <div
          className="grid gap-3 sm:grid-cols-2"
          aria-busy="true"
          aria-label="در حال بارگذاری لیست خرید"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-xl border border-border/70 bg-card/70"
            />
          ))}
        </div>
      ) : error ? (
        <section className="rounded-xl border border-border bg-card px-5 py-10 text-center">
          <p className="font-bold">دریافت لیست خرید انجام نشد</p>
          <p className="mt-1 text-sm text-muted-foreground">
            اتصال را بررسی کن و دوباره تلاش کن.
          </p>
          <Button variant="outline" className="mt-4" onClick={refresh}>
            تلاش دوباره
          </Button>
        </section>
      ) : !items.length ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center sm:py-14">
          <BookOpen className="mx-auto size-7 text-muted-foreground" />
          <h2 className="mt-3 font-bold">هنوز کتابی در لیستت نیست</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            کتاب موردنظرت را در کاتالوگ قفسه جست‌وجو کن.
          </p>
          <Button
            onClick={startSearch}
            variant="outline"
            className="mt-4 rounded-lg"
          >
            <Search className="size-4" /> جست‌وجوی کتاب‌ها
          </Button>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filterQuery}
                  onChange={(event) => setFilterQuery(event.target.value)}
                  placeholder="جست‌وجو در لیست خرید..."
                  aria-label="جست‌وجو در لیست خرید"
                  className="h-10 rounded-xl border-border/70 bg-background/70 pr-9"
                />
              </div>
              <div
                role="group"
                aria-label="فیلتر اولویت"
                className="flex w-full gap-1.5 overflow-x-auto pb-0.5 lg:w-auto"
              >
                {[
                  { value: "ALL" as const, label: "همه", count: items.length },
                  ...priorities.map((item) => ({
                    ...item,
                    count: priorityCount(item.value),
                  })),
                ].map((filter) => {
                  const active = activeFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setActiveFilter(filter.value)}
                      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition sm:px-3.5 ${active ? "border-primary/20 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"}`}
                    >
                      {filter.label}
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-primary/10" : "bg-muted"}`}
                      >
                        {filter.count.toLocaleString("fa-IR")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {filteredItems.length ? (
            <section aria-label="کتاب‌های لیست خرید">
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {filteredItems.map((item) => (
                  <article
                    key={item.id}
                    className="group flex min-h-[176px] min-w-0 gap-3.5 overflow-hidden rounded-2xl border border-border/70 bg-card p-3.5 transition-all hover:border-primary/25 hover:shadow-[0_12px_28px_-24px_rgba(30,70,50,0.45)] sm:gap-4 sm:rounded-2xl sm:p-4"
                  >
                    <div className="relative h-[126px] w-[84px] shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-black/5 sm:h-[144px] sm:w-[96px]">
                      <BookCoverImage
                        src={item.coverImage}
                        alt={`جلد کتاب ${item.title}`}
                        fill
                        sizes="(max-width: 640px) 84px, 96px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex min-h-[126px] min-w-0 flex-1 flex-col sm:min-h-[144px]">
                      {item.catalogBookId ? (
                        <Link
                          href={`/book/${encodeURIComponent(item.catalogBookId)}`}
                          className="line-clamp-2 text-base font-black leading-7 text-foreground transition-colors hover:text-primary sm:text-lg"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <h3 className="line-clamp-2 text-base font-black leading-7 text-foreground sm:text-lg">
                          {item.title}
                        </h3>
                      )}
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                        {item.author}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                        <Select
                          value={item.priority}
                          onValueChange={(value) =>
                            changePriority(item, value as Priority)
                          }
                          disabled={busyId === item.id}
                        >
                          <SelectTrigger
                            aria-label={`تغییر اولویت ${item.title}`}
                            className={`h-9 w-[108px] rounded-lg border px-2.5 text-xs font-bold ${priorityTone[item.priority]}`}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {priorities.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => setBuying(item)}
                            disabled={busyId === item.id}
                            className="h-9 rounded-lg px-3 text-xs"
                          >
                            <ShoppingCart className="size-3.5" /> خریدم
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`حذف ${item.title}`}
                            title="حذف از لیست"
                            className="size-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => remove(item)}
                            disabled={busyId === item.id}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-12 text-center">
              <Search className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 font-bold">نتیجه‌ای پیدا نشد</p>
              <p className="mt-1 text-sm text-muted-foreground">
                عبارت جست‌وجو یا فیلتر اولویت را تغییر بده.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setFilterQuery("");
                  setActiveFilter("ALL");
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            </section>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[92dvh] gap-5 overflow-y-auto rounded-2xl border-border/70 bg-card p-4 sm:max-w-xl sm:rounded-3xl sm:p-6"
          dir="rtl"
        >
          <DialogHeader className="pr-1">
            <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Search className="size-5" />
            </span>
            <DialogTitle className="text-base font-black sm:text-lg">
              جست‌وجوی کتاب در قفسه
            </DialogTitle>
            <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
              از میان کتاب‌های سایت انتخاب کن تا به لیست خرید اضافه شوند.
            </p>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResults([]);
                setSelected(null);
                setSearching(event.target.value.trim().length >= 2);
              }}
              placeholder="نام کتاب، نویسنده یا شابک..."
              aria-label="جست‌وجو میان کتاب‌های سایت"
              className="h-11 rounded-xl border-border/70 bg-background/80 pr-10"
            />
          </div>
          <div
            className="max-h-[38dvh] space-y-2 overflow-y-auto rounded-xl bg-background/50 p-1"
            aria-live="polite"
          >
            {query.trim().length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                برای جست‌وجو دست‌کم دو نویسه بنویس.
              </p>
            ) : searching ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> در حال جست‌وجو...
              </p>
            ) : searchError ? (
              <p className="py-8 text-center text-sm text-destructive">
                جست‌وجو ناموفق بود. دوباره تلاش کن.
              </p>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                کتابی در کاتالوگ پیدا نشد.
              </p>
            ) : (
              results.map((book) => {
                const alreadyAdded = items.some(
                  (item) => item.catalogBookId === book.id,
                );
                return (
                  <button
                    key={book.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => setSelected(book)}
                    aria-pressed={selected?.id === book.id}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-right transition-colors disabled:cursor-default disabled:opacity-55 ${selected?.id === book.id ? "border-primary/40 bg-primary/[0.08]" : "border-border/70 bg-card hover:border-primary/30"}`}
                  >
                    <div className="relative h-[68px] w-12 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm">
                      <BookCoverImage
                        src={book.editions[0]?.coverImage}
                        alt={book.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">
                        {book.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {book.author}
                      </span>
                    </span>
                    {alreadyAdded ? (
                      <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                        در لیست خرید
                      </span>
                    ) : selected?.id === book.id ? (
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-4" />
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          {selected && (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-3">
              <p className="mb-2 line-clamp-1 text-sm font-bold text-foreground">
                {selected.title}
              </p>
              <label className="block text-xs font-bold text-muted-foreground">
                اولویت خرید
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as Priority)}
                >
                  <SelectTrigger className="mt-1.5 w-full rounded-xl border-border/70 bg-background">
                    <SelectValue placeholder="انتخاب اولویت" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          )}
          <Button
            onClick={addSelected}
            disabled={!selected || !priority || busyId === "create"}
            className="h-11 rounded-xl font-bold"
          >
            {busyId === "create" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> در حال افزودن...
              </>
            ) : (
              <>
                <Plus className="size-4" /> افزودن به لیست خرید
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!buying}
        onOpenChange={(value) => {
          if (!value) setBuying(null);
        }}
      >
        <DialogContent
          className="rounded-2xl border-border/70 bg-card sm:max-w-md sm:rounded-3xl"
          dir="rtl"
        >
          <DialogHeader>
            <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="size-5" />
            </span>
            <DialogTitle className="text-base font-black">
              «{buying?.title}» را خریدی؟
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            می‌خواهی این کتاب را به کتابخانهٔ شخصی‌ات هم اضافه کنی؟
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => buy(true)}
              disabled={!!busyId}
              className="rounded-xl"
            >
              <BookOpen className="size-4" /> بله، به کتابخانه اضافه کن
            </Button>
            <Button
              variant="outline"
              onClick={() => buy(false)}
              disabled={!!busyId}
              className="rounded-xl"
            >
              فقط ثبت خرید
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
