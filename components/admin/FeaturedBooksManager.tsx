"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import type {
  AdminFeaturedBook,
  FeaturedBookSearchResult,
} from "@/lib/home/service";

function Cover({ src, alt }: { src: string | null; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <BookOpen className="h-4 w-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="h-14 w-10 shrink-0 rounded-md object-cover"
    />
  );
}

export default function FeaturedBooksManager() {
  const confirm = useConfirm();
  const [items, setItems] = useState<AdminFeaturedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<FeaturedBookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/home/featured", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []);
      else toast.error(data.error || "خطا در بارگذاری");
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // جست‌وجوی کتاب (دیبانس)
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/home/books?q=${encodeURIComponent(q.trim())}`,
          { credentials: "include", signal: ctrl.signal }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `جست‌وجو ناموفق بود (${res.status})`);
        setResults(data?.results ?? []);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const message = err instanceof Error ? err.message : "خطا در جست‌وجو";
        setSearchError(message);
        toast.error(message);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  const featuredCatalogBookIds = new Set(
    items
      .map((item) => item.resolvedCatalogBookId ?? item.catalogBookId)
      .filter((value): value is string => Boolean(value)),
  );

  const add = async (catalogBookId: string) => {
    setBusyId(catalogBookId);
    try {
      const res = await fetch("/api/admin/home/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ catalogBookId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "افزودن ناموفق بود");
        return;
      }
      toast.success("به پیشنهادها افزوده شد");
      setQ("");
      setResults([]);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (item: AdminFeaturedBook) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/admin/home/featured/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) {
        toast.error("به‌روزرسانی ناموفق بود");
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, isActive: !i.isActive } : i
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = (item: AdminFeaturedBook) => {
    void confirm({
      title: "حذف از پیشنهادها",
      description: `«${item.title}» از کتاب‌های پیشنهادی صفحه‌ی اصلی حذف شود؟`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/home/featured/${item.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          toast.error("حذف ناموفق بود");
          return;
        }
        toast.success("حذف شد");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      },
    });
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await fetch("/api/admin/home/featured/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderedIds: next.map((i) => i.id) }),
      });
    } catch {
      toast.error("ذخیره‌ی ترتیب ناموفق بود");
      void load();
    }
  };

  return (
    <div className="space-y-6">
      {/* افزودن کتاب */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <Plus className="h-4 w-4 text-primary" />
          افزودن کتاب پیشنهادی
        </h2>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جست‌وجوی کتاب بر اساس عنوان..."
        />

        {q.trim() ? (
          <div className="mt-3 space-y-1.5">
            {searching ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                در حال جست‌وجو...
              </p>
            ) : searchError ? (
              <p className="px-1 py-2 text-xs text-destructive">{searchError}</p>
            ) : results.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                کتابی پیدا نشد.
              </p>
            ) : (
              results.map((b) => {
                const already = featuredCatalogBookIds.has(b.id);
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-2"
                  >
                    <Cover src={b.coverImage} alt={b.title} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {b.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.author}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={already || busyId === b.id}
                      onClick={() => add(b.id)}
                      className="gap-1.5"
                      aria-busy={busyId === b.id}
                    >
                      <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        <Loader2
                          className={cn(
                            "absolute h-3.5 w-3.5 transition-opacity",
                            busyId === b.id
                              ? "animate-spin opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <Plus
                          className={cn(
                            "absolute h-3.5 w-3.5 transition-opacity",
                            busyId === b.id ? "opacity-0" : "opacity-100"
                          )}
                        />
                      </span>
                      <span>{already ? "افزوده‌شده" : "افزودن"}</span>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {/* فهرست پیشنهادها */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">
          کتاب‌های پیشنهادی ({items.length.toLocaleString("fa-IR")})
        </h2>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            در حال بارگذاری...
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            هنوز کتاب پیشنهادی‌ای انتخاب نشده است. در نبود انتخاب، صفحه‌ی اصلی
            کتاب‌های اخیر عمومی را نشان می‌دهد.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-2",
                  !item.isActive && "opacity-60"
                )}
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="بالا"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="پایین"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <Cover src={item.coverImage} alt={item.title} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.author}
                  </p>
                  {item.catalogBookId ? (
                    <p className="truncate text-[11px] text-muted-foreground/80">
                      کاتالوگ: {item.catalogBookId}
                    </p>
                  ) : item.bookId ? (
                    <p className="truncate text-[11px] text-muted-foreground/80">
                      ارجاع قدیمی کتابخانه
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  disabled={busyId === item.id}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                    item.isActive
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {item.isActive ? "فعال" : "غیرفعال"}
                </button>

                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label="حذف"
                  title="حذف"
                  className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
