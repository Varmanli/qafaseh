"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  Loader2,
  Plus,
  Quote,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/Carousel";
import QuoteCard from "@/components/profile/QuoteCard";
import QuoteDialog from "@/components/quotes/QuoteDialog";
import { useConfirm } from "@/components/common/ConfirmDialog";
import type { PublicQuote } from "@/lib/quotes/service";
import {
  QUOTE_BACKGROUNDS,
  type QuoteBackground as QuoteBackgroundVariant,
} from "@/lib/quotes/backgrounds";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/book/cover";
import { normalizeQuoteBackground } from "@/lib/quotes/backgrounds";

export default function BookQuotesSection({
  subjectBookId,
  viewerEntryId,
  viewerIsAdmin = false,
  isLoggedIn,
  quotes,
  totalQuoteCount,
  variant = "preview",
  viewAllHref,
  showBook = false,
  initialHasMore = false,
  flat = false,
}: {
  subjectBookId: string;
  viewerEntryId: string | null;
  viewerIsAdmin?: boolean;
  isLoggedIn: boolean;
  quotes: PublicQuote[];
  totalQuoteCount?: number;
  variant?: "preview" | "all";
  viewAllHref?: string;
  /** Book pages already establish context, so their cards omit repeated book metadata. */
  showBook?: boolean;
  initialHasMore?: boolean;
  flat?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [items, setItems] = useState(quotes);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [limit, setLimit] = useState(3);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobile) {
      setLimit(items.length);
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLimit((prev) => Math.min(prev + 3, items.length));
        }
      },
      {
        rootMargin: "200px",
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [items.length, limit]);

  useEffect(() => {
    setItems(quotes);
  }, [quotes]);

  useEffect(() => {
    setHasMore(initialHasMore);
  }, [initialHasMore]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      const response = await fetch(
        `/api/books/${encodeURIComponent(subjectBookId)}/quotes?page=${nextPage}`
      );
      const data = await response.json();
      if (!response.ok || !data.quotes) {
        throw new Error();
      }

      setItems((current) => [
        ...current,
        ...data.quotes.filter(
          (item: PublicQuote) => !current.some((old) => old.id === item.id)
        ),
      ]);
      setCurrentPage(nextPage);
      setHasMore(Boolean(data.page < data.pageCount));
    } catch {
      // Ignore
    } finally {
      setLoadingMore(false);
    }
  }

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicQuote | null>(null);
  const [content, setContent] = useState("");
  const [page, setPage] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [background, setBackground] =
    useState<QuoteBackgroundVariant>("default");
  const [backgroundsList, setBackgroundsList] = useState<
    Array<{ value: string; label: string }>
  >([...QUOTE_BACKGROUNDS]);
  const [uploading, setUploading] = useState(false);
  const unsavedImageKeys = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/quotes/backgrounds")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (
          isMounted &&
          data?.backgrounds &&
          Array.isArray(data.backgrounds) &&
          data.backgrounds.length > 0
        ) {
          setBackgroundsList(data.backgrounds);
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  const hasQuotes = quotes.length > 0;
  const showViewAll =
    variant === "preview" && Boolean(viewAllHref) && hasQuotes;

  function openAdd() {
    setEditing(null);
    setContent("");
    setPage("");
    setImageKey(null);
    setImagePreview(null);
    setBackground("default");
    setOpen(true);
  }

  function openEdit(quote: PublicQuote) {
    setEditing(quote);
    setContent(quote.content);
    setPage(quote.page ? String(quote.page) : "");
    setImageKey(quote.imageKey);
    setImagePreview(normalizeMediaUrl(quote.imageKey));
    setBackground(normalizeQuoteBackground(quote.background));
    setOpen(true);
  }

  async function ensureEntryId(): Promise<string> {
    if (viewerEntryId) return viewerEntryId;

    const res = await fetch(`/api/book/${subjectBookId}/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "UNREAD" }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "خطا");
    }

    return data.bookId as string;
  }

  async function submit() {
    const text = content.trim();
    const normalizedPage = page ? Number(page) : null;

    if ((!text && !imageKey) || busy || uploading) return;

    setBusy(true);

    try {
      if (editing) {
        const res = await fetch(`/api/quotes/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            page: normalizedPage,
            imageKey,
            background,
          }),
        });

        if (!res.ok) {
          throw new Error((await res.json()).error || "خطا");
        }

        toast.success("تکه بروزرسانی شد");
      } else {
        const bookId = await ensureEntryId();

        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            page: normalizedPage ?? undefined,
            bookId,
            imageKey,
            background,
          }),
        });

        if (!res.ok) {
          throw new Error((await res.json()).error || "خطا");
        }

        toast.success("تکه منتشر شد");
      }

      unsavedImageKeys.current.clear();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function cleanupImage(key: string) {
    try {
      await fetch("/api/upload/image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    } catch {
      // Best-effort cleanup; the persisted quote is never rolled back.
    } finally {
      unsavedImageKeys.current.delete(key);
    }
  }

  function handleImageKeyChange(nextKey: string) {
    const previousKey = imageKey;
    if (
      previousKey &&
      unsavedImageKeys.current.has(previousKey) &&
      previousKey !== nextKey
    ) {
      void cleanupImage(previousKey);
    }
    if (nextKey) unsavedImageKeys.current.add(nextKey);
    setImageKey(nextKey || null);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && !busy) {
      for (const key of unsavedImageKeys.current) void cleanupImage(key);
    }
    setOpen(nextOpen);
  }

  async function remove(id: string) {
    await confirm({
      title: "حذف تکه",
      description: "این تکه حذف شود؟ این عملیات قابل بازگشت نیست.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });

          if (!res.ok) {
            throw new Error((await res.json()).error || "خطا");
          }

          toast.success("تکه حذف شد.");
          router.refresh();
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "حذف تکه ناموفق بود.",
          );
        }
      },
    });
  }

  function renderQuoteCard(quote: PublicQuote) {
    const canManage =
      viewerIsAdmin || Boolean(viewerEntryId && quote.bookId === viewerEntryId);

    return (
        <QuoteCard
        key={quote.id}
        quote={quote}
        canLike={isLoggedIn}
        showAuthor
        showBook={showBook}
        background={quote.background}
        manage={
          canManage
            ? {
                onEdit: () => openEdit(quote),
                onDelete: () => remove(quote.id),
              }
            : undefined
        }
      />
    );
  }

  return (
    <section className={cn("relative", !flat && "overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md transition-all hover:border-border/80")}>
      <div className="relative">
        <div className={cn(!flat ? "border-b border-border/40 p-4 sm:p-5" : "px-1 mb-4")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Quote className="h-4 w-4" />
              </span>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-foreground sm:text-lg">
                    تکه‌های کتاب
                  </h2>
                  {hasQuotes ? (
                    <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {(totalQuoteCount ?? quotes.length).toLocaleString(
                        "fa-IR",
                      )}{" "}
                      تکه
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {showViewAll && viewAllHref ? (
                <Link
                  href={viewAllHref}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border text-xs font-bold text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary shrink-0",
                    flat ? "bg-background/20 border-border/50 px-3" : "border-border/60 bg-background/40 px-3"
                  )}
                >
                  مشاهده کامل
                </Link>
              ) : null}

              {isLoggedIn ? (
                <Button
                  type="button"
                  onClick={openAdd}
                  data-onboarding="book-quote"
                  className="h-8 gap-1.5 rounded-xl px-3 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن تکه
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={!flat ? "p-4 sm:p-5" : "py-1"}>
          {!hasQuotes ? (
            <EmptyQuotesState isLoggedIn={isLoggedIn} onAdd={openAdd} />
          ) : variant === "preview" ? (
            <div className="relative">
              <Carousel
                className="py-1"
                ariaLabel="تکه‌های کتاب"
                slideClassName="w-[min(84vw,320px)] flex-none snap-start md:w-auto md:basis-1/2 xl:basis-1/3 px-1"
                containerClassName="gap-4 lg:gap-5"
                slides={(() => {
                  const carouselSlides = items.slice(0, limit).map(renderQuoteCard);
                  if (limit < items.length) {
                    carouselSlides.push(
                      <div
                        ref={sentinelRef}
                        key="sentinel"
                        className="w-1 h-full shrink-0 flex items-center justify-center"
                      />
                    );
                  }
                  return carouselSlides;
                })()}
              />
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(renderQuoteCard)}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="h-10 rounded-full border border-border/60 bg-background/30 px-6 text-xs font-bold text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-primary gap-2 cursor-pointer transition-colors"
                  >
                    {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    مشاهده بیشتر
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <QuoteDialog
        open={open}
        editing={editing}
        content={content}
        page={page}
        busy={busy}
        imageKey={imageKey}
        imagePreview={imagePreview}
        uploading={uploading}
        background={background}
        backgroundsList={backgroundsList}
        onOpenChange={handleDialogOpenChange}
        onContentChange={setContent}
        onPageChange={setPage}
        onImagePreviewChange={(value) => setImagePreview(value || null)}
        onImageKeyChange={handleImageKeyChange}
        onUploadStateChange={setUploading}
        onBackgroundChange={setBackground}
        onSubmit={submit}
      />
    </section>
  );
}

function EmptyQuotesState({
  isLoggedIn,
  onAdd,
}: {
  isLoggedIn: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-background/30 px-4 py-8 text-center">
      <div>
        <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary/70">
          <BookOpenText className="h-6 w-6" />
        </div>

        <p className="mt-3 text-sm font-semibold text-foreground">
          هنوز تکه‌ای منتشر نشده
        </p>

        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
          {isLoggedIn
            ? "اولین جمله یا بخش به‌یادماندنی این کتاب را منتشر کن تا اینجا جان بگیرد."
            : "هنوز خواننده‌ای تکه‌ای از این کتاب منتشر نکرده است."}
        </p>

        {isLoggedIn ? (
          <Button
            type="button"
            onClick={onAdd}
            className="mt-4 h-8 rounded-xl px-3 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن اولین تکه
          </Button>
        ) : null}
      </div>
    </div>
  );
}
