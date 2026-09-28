"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  Check,
  Loader2,
  Plus,
  Quote,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Carousel } from "@/components/ui/Carousel";
import QuoteCard, {
  QuoteBackground as QuoteBackgroundPreview,
} from "@/components/profile/QuoteCard";
import { useConfirm } from "@/components/common/ConfirmDialog";
import type { PublicQuote } from "@/lib/quotes/service";
import {
  QUOTE_BACKGROUNDS,
  type QuoteBackground as QuoteBackgroundVariant,
} from "@/lib/quotes/backgrounds";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/book/cover";
import { getQuoteTextareaDirectionProps } from "@/lib/text-direction";
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

  function renderQuoteCard(quote: PublicQuote, index?: number) {
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
        priority={index === 0}
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
                  const carouselSlides = items.slice(0, limit).map((quote, index) => renderQuoteCard(quote, index));
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

function QuoteDialog({
  open,
  editing,
  content,
  page,
  busy,
  imageKey,
  imagePreview,
  uploading,
  background,
  backgroundsList,
  onOpenChange,
  onContentChange,
  onPageChange,
  onImagePreviewChange,
  onImageKeyChange,
  onUploadStateChange,
  onBackgroundChange,
  onSubmit,
}: {
  open: boolean;
  editing: PublicQuote | null;
  content: string;
  page: string;
  busy: boolean;
  imageKey: string | null;
  imagePreview: string | null;
  uploading: boolean;
  background: QuoteBackgroundVariant;
  backgroundsList: Array<{ value: string; label: string }>;
  onOpenChange: (open: boolean) => void;
  onContentChange: (value: string) => void;
  onPageChange: (value: string) => void;
  onImagePreviewChange: (value: string) => void;
  onImageKeyChange: (key: string) => void;
  onUploadStateChange: (uploading: boolean) => void;
  onBackgroundChange: (background: QuoteBackgroundVariant) => void;
  onSubmit: () => void;
}) {
  const [tab, setTab] = useState<"text" | "image">("text");

  useEffect(() => {
    if (open) {
      // Direct edit mode tab selection: if it has an image and no text content, start on image tab
      setTab(imageKey && !content ? "image" : "text");
    }
  }, [open, editing, imageKey, content]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] flex flex-col sm:max-w-lg md:max-w-xl rounded-2xl border-border/85 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex flex-col gap-1 px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-bold text-foreground">
              {editing ? "ویرایش تکه کتاب" : "افزودن تکه کتاب"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pr-10">
            جمله یا بخشی از کتاب را بنویسید یا تصویر آن را بارگذاری کنید.
          </DialogDescription>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4 shrink-0">
          <div className="flex rounded-xl bg-muted/50 p-1 border border-border/30">
            <button
              type="button"
              onClick={() => setTab("text")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer",
                tab === "text"
                  ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.05]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              متن تکه
            </button>
            <button
              type="button"
              onClick={() => setTab("image")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer",
                tab === "image"
                  ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.05]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              تصویر صفحه
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === "text" ? (
            <>
              {/* Text editor with Live Preview background */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-[1.45rem] border min-h-[205px] sm:min-h-[230px] transition-all flex flex-col justify-center items-center",
                  background === "default"
                    ? "border-border/60 bg-background/30"
                    : "border-border/50 bg-card/20",
                )}
              >
                {/* Selected background preview */}
                <QuoteBackgroundPreview variant={background} />

                {/* Decorative quote marks */}
                <Quote
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute right-4 top-4 z-[1] h-7 w-7 sm:right-5 sm:top-5 sm:h-8 sm:w-8 opacity-25",
                    background === "default" ? "text-primary/25" : "text-white/35",
                  )}
                />

                <Quote
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute bottom-4 left-4 z-[1] h-7 w-7 rotate-180 sm:bottom-5 sm:left-5 sm:h-8 sm:w-8 opacity-15",
                    background === "default" ? "text-primary/10" : "text-white/15",
                  )}
                />

                {/* Centered editor area matching QuoteCard composition */}
                <div className="relative z-10 w-full flex-1 flex flex-col justify-center items-center px-5 py-6 sm:px-7 sm:py-7">
                  <div className="mx-auto w-full max-w-[34rem] flex items-center justify-center">
                    <Textarea
                      {...getQuoteTextareaDirectionProps(content)}
                      value={content}
                      onChange={(event) => onContentChange(event.target.value)}
                      placeholder="یک تکه از کتاب را نقل کن..."
                      rows={1}
                      className={cn(
                        "w-full bg-transparent text-center resize-none border-0 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 overflow-hidden field-sizing-content",
                        "text-[13px] font-medium leading-7",
                        "sm:text-[15px] sm:leading-[2.2]",
                        "md:text-[1rem] md:leading-[2.3]",
                        background === "default"
                          ? "text-foreground/95 placeholder:text-muted-foreground/75"
                          : "text-white placeholder:text-white/60 [text-shadow:0_1px_18px_rgba(0,0,0,0.55)]",
                      )}
                    />
                  </div>
                  
                  {/* Page Badge matching actual QuoteCard bottom-left positioning */}
                  {page && (
                    <div
                      className={cn(
                        "absolute bottom-4 left-5 sm:bottom-5 sm:left-7 z-10 flex shrink-0 items-center gap-1.5 text-[10px] font-medium tabular-nums",
                        background === "default" ? "text-muted-foreground" : "text-white/75",
                      )}
                    >
                      <BookOpen className="h-3.5 w-3.5 opacity-70" />
                      صفحه {Number(page).toLocaleString("fa-IR")}
                    </div>
                  )}
                </div>
              </div>

              {/* Redesigned Background Selector */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold px-0.5">
                  <span className="text-foreground/90">طرح پس‌زمینه</span>
                  <span className="text-muted-foreground/75">
                    {backgroundsList.find((item) => item.value === background)?.label ?? "پیش‌فرض"}
                  </span>
                </div>

                <Carousel
                  ariaLabel="طرح‌های پس‌زمینه"
                  slideClassName="w-24 shrink-0"
                  containerClassName="gap-2.5"
                  className="-mx-1 px-1"
                  slides={backgroundsList.map((item) => {
                    const selected = background === item.value;
                    const isDefault = item.value === "default";

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => onBackgroundChange(item.value)}
                        disabled={busy || uploading}
                        aria-pressed={selected}
                        className={cn(
                          "group relative w-full h-15 overflow-hidden rounded-xl border text-right transition-all duration-200 cursor-pointer",
                          selected
                            ? "border-primary ring-2 ring-primary/20 ring-offset-1"
                            : "border-border/50 hover:border-foreground/20",
                        )}
                      >
                        {/* Visual Thumbnail */}
                        <div className="absolute inset-0 w-full h-full scale-[1.01]">
                          <QuoteBackgroundPreview variant={item.value} />
                        </div>

                        {/* Subtle text label badge */}
                        <span
                          className={cn(
                            "absolute bottom-1 right-1 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black backdrop-blur-[2px] transition-colors",
                            isDefault
                              ? "bg-background/80 text-foreground"
                              : "bg-black/40 text-white",
                          )}
                        >
                          {item.label}
                        </span>

                        {/* Check indicator for selected */}
                        {selected && (
                          <span className="absolute left-1 top-1 z-10 grid h-4.5 w-4.5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="h-2.5 w-2.5 stroke-[3px]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                />
              </div>
            </>
          ) : (
            /* Image Tab Content */
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/50 bg-background/30 p-2 sm:p-3">
                <ImageUploader
                  value={imagePreview}
                  onChange={onImagePreviewChange}
                  onKeyChange={onImageKeyChange}
                  onUploadStateChange={onUploadStateChange}
                  folder="quotes"
                  variant="document"
                  label="افزودن تصویر از صفحه کتاب"
                  description="فرمت‌های JPEG، PNG و WebP تا حجم ۸ مگابایت پذیرفته می‌شوند."
                  disabled={busy}
                />
              </div>
            </div>
          )}

          {/* Page Number Row */}
          <div className="flex items-center gap-3 pt-1">
            <label className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/30 px-3 sm:w-56">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                شماره صفحه
              </span>
              <input
                value={page}
                onChange={(event) =>
                  onPageChange(event.target.value.replace(/[^0-9]/g, ""))
                }
                inputMode="numeric"
                placeholder="اختیاری"
                className="h-8 w-24 bg-transparent text-left text-xs font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 p-4 shrink-0 bg-card">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy || uploading}
            className="h-9 rounded-xl px-4 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
          >
            بستن
          </Button>

          <Button
            type="button"
            onClick={onSubmit}
            disabled={busy || uploading || (!content.trim() && !imageKey)}
            className="h-9 rounded-xl px-5 text-xs font-bold gap-1.5 cursor-pointer"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {editing ? "ذخیره تغییرات" : "انتشار تکه"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
