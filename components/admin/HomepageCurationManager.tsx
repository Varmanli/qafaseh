"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FEATURED_AUTHOR_LIMIT,
  FEATURED_BLOG_POST_LIMIT,
  type HomepageCuration,
} from "@/lib/home/curation-types";

type CurationKind = "authors" | "posts";
type CurationItem = {
  id: string;
  name?: string;
  title?: string;
  coverImage?: string | null;
  bannerImage?: string;
  categoryName?: string | null;
};

function Thumbnail({ item, kind }: { item: CurationItem; kind: CurationKind }) {
  const image = kind === "authors" ? item.coverImage : item.bannerImage;
  const label = kind === "authors" ? item.name! : item.title!;

  if (!image) {
    const Icon = kind === "authors" ? UserRound : ImageIcon;
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={label} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
  );
}

function itemTitle(item: CurationItem, kind: CurationKind) {
  return kind === "authors" ? item.name! : item.title!;
}

function itemMeta(item: CurationItem, kind: CurationKind) {
  return kind === "posts" ? item.categoryName ?? "بدون دسته‌بندی" : null;
}

export default function HomepageCurationManager() {
  const [curation, setCuration] = useState<HomepageCuration>({ authors: [], posts: [] });
  const [saved, setSaved] = useState<HomepageCuration>({ authors: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState<Record<CurationKind, string>>({ authors: "", posts: "" });
  const [results, setResults] = useState<Record<CurationKind, CurationItem[]>>({ authors: [], posts: [] });
  const [searching, setSearching] = useState<Record<CurationKind, boolean>>({ authors: false, posts: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/home/curation", { credentials: "include", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در بارگذاری");
      const next = { authors: data.authors ?? [], posts: data.posts ?? [] };
      setCuration(next);
      setSaved(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const controllers = new Map<CurationKind, AbortController>();
    const timeout = setTimeout(() => {
      (Object.keys(query) as CurationKind[]).forEach((kind) => {
        const value = query[kind].trim();
        if (!value) {
          setResults((current) => ({ ...current, [kind]: [] }));
          return;
        }
        const controller = new AbortController();
        controllers.set(kind, controller);
        setSearching((current) => ({ ...current, [kind]: true }));
        void fetch(`/api/admin/home/curation/search?type=${kind}&q=${encodeURIComponent(value)}`, {
          credentials: "include",
          signal: controller.signal,
        })
          .then((response) => response.json().then((data) => ({ response, data })))
          .then(({ response, data }) => {
            if (!response.ok) throw new Error(data.error || "جست‌وجو ناموفق بود");
            setResults((current) => ({ ...current, [kind]: data.results ?? [] }));
          })
          .catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            toast.error(error instanceof Error ? error.message : "جست‌وجو ناموفق بود");
          })
          .finally(() => setSearching((current) => ({ ...current, [kind]: false })));
      });
    }, 300);

    return () => {
      clearTimeout(timeout);
      controllers.forEach((controller) => controller.abort());
    };
  }, [query]);

  const updateItems = (kind: CurationKind, items: CurationItem[]) => {
    setCuration((current) => ({ ...current, [kind]: items }));
  };

  const add = (kind: CurationKind, item: CurationItem) => {
    const limit = kind === "authors" ? FEATURED_AUTHOR_LIMIT : FEATURED_BLOG_POST_LIMIT;
    const items = curation[kind];
    if (items.some((selected) => selected.id === item.id) || items.length >= limit) return;
    updateItems(kind, [...items, item]);
    setQuery((current) => ({ ...current, [kind]: "" }));
    setResults((current) => ({ ...current, [kind]: [] }));
  };

  const move = (kind: CurationKind, index: number, direction: -1 | 1) => {
    const items = [...curation[kind]];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    updateItems(kind, items);
  };

  const remove = (kind: CurationKind, id: string) => {
    updateItems(kind, curation[kind].filter((item) => item.id !== id));
  };

  const hasChanges = JSON.stringify(curation) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/home/curation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          authorIds: curation.authors.map((item) => item.id),
          postIds: curation.posts.map((item) => item.id),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ذخیره ناموفق بود");
      setSaved(curation);
      toast.success(data.message || "تنظیمات صفحه اصلی ذخیره شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد");
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (kind: CurationKind, title: string, description: string) => {
    const items = curation[kind];
    const limit = kind === "authors" ? FEATURED_AUTHOR_LIMIT : FEATURED_BLOG_POST_LIMIT;
    const selectedIds = new Set(items.map((item) => item.id));

    return (
      <section className="rounded-2xl border border-border bg-card p-4" key={kind}>
        <div className="mb-4">
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query[kind]}
            onChange={(event) => setQuery((current) => ({ ...current, [kind]: event.target.value }))}
            disabled={items.length >= limit}
            placeholder={kind === "authors" ? "جست‌وجوی نویسنده..." : "جست‌وجوی عنوان مطلب..."}
            className="pr-9"
          />
        </div>

        {query[kind].trim() ? (
          <div className="mt-2 space-y-1.5 rounded-xl border border-border/70 bg-muted/20 p-2">
            {searching[kind] ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">در حال جست‌وجو...</p>
            ) : results[kind].length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">موردی پیدا نشد.</p>
            ) : (
              results[kind].map((item) => {
                const alreadySelected = selectedIds.has(item.id);
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg p-1.5">
                    <Thumbnail item={item} kind={kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{itemTitle(item, kind)}</p>
                      {itemMeta(item, kind) ? <p className="truncate text-xs text-muted-foreground">{itemMeta(item, kind)}</p> : null}
                    </div>
                    <Button size="sm" disabled={alreadySelected || items.length >= limit} onClick={() => add(kind, item)} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      {alreadySelected ? "افزوده‌شده" : "افزودن"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            انتخاب‌شده‌ها ({items.length.toLocaleString("fa-IR")} از {limit.toLocaleString("fa-IR")})
          </p>
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">هنوز موردی انتخاب نشده است.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/25 p-2">
                  <div className="flex flex-col">
                    <button type="button" aria-label="بالا" disabled={index === 0} onClick={() => move(kind, index, -1)} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="پایین" disabled={index === items.length - 1} onClick={() => move(kind, index, 1)} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  </div>
                  <Thumbnail item={item} kind={kind} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{itemTitle(item, kind)}</p>
                    {itemMeta(item, kind) ? <p className="truncate text-xs text-muted-foreground">{itemMeta(item, kind)}</p> : null}
                  </div>
                  <button type="button" onClick={() => remove(kind, item.id)} aria-label="حذف" className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  };

  if (loading) return <p className="py-6 text-center text-sm text-muted-foreground">در حال بارگذاری تنظیمات منتخب...</p>;

  return (
    <div className="space-y-4">
      {renderSection("authors", "نویسنده‌های منتخب", "حداکثر ۶ نویسنده را جست‌وجو، انتخاب و مرتب کنید.")}
      {renderSection("posts", "از مجله قفسه", "حداکثر ۳ مطلب منتشرشده را جست‌وجو، انتخاب و مرتب کنید.")}
      <div className="flex justify-end">
        <Button onClick={save} disabled={!hasChanges || saving} className="min-w-36 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          ذخیره تغییرات
        </Button>
      </div>
    </div>
  );
}
