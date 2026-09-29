"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Heart,
  Handshake,
  MoreVertical,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import BookCoverImage from "@/components/books/BookCoverImage";
import { getPublicBookHref } from "@/lib/book/public-href";
import { cn } from "@/lib/utils";
import type { LibraryBook } from "@/lib/library/service";

const STATUS_LABELS: Record<LibraryBook["status"], string> = {
  UNREAD: "خوانده‌نشده",
  READING: "درحال خواندن",
  PAUSED: "متوقف‌شده",
  STOPPED: "متوقف‌شده",
  FINISHED: "خوانده‌شده",
};

const STATUS_STYLES: Record<LibraryBook["status"], string> = {
  UNREAD: "bg-background/80 text-muted-foreground ring-border",
  READING: "bg-primary/15 text-primary ring-primary/25",
  PAUSED:
    "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  STOPPED:
    "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  FINISHED:
    "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
};

export default function LibraryBookCard({
  book,
  canManage,
  onCycleStatus,
  onDelete,
  viewMode = "grid",
}: {
  book: LibraryBook;
  canManage: boolean;
  onCycleStatus?: (book: LibraryBook) => void;
  onDelete?: (book: LibraryBook) => void;
  viewMode?: "grid" | "list";
}) {
  const bookHref =
    getPublicBookHref(book) ?? `/book/${encodeURIComponent(book.id)}`;
  const myReadingHref = `/book/${encodeURIComponent(book.id)}/my`;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const progressSection =
    book.status === "READING" && typeof book.progress === "number" ? (
      <div className="w-full mb-2" dir="rtl">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>{Math.round(book.progress)}٪ خوانده شده</span>
          {book.pageCount && (
            <span>
              {book.currentPage} از {book.pageCount}
            </span>
          )}
        </div>
        <div className="h-1 w-full bg-secondary/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${book.progress}%` }}
          />
        </div>
      </div>
    ) : null;

  if (viewMode === "list") {
    return (
      <article className="group relative flex items-center justify-between rounded-xl border border-border/40 bg-card/35 p-2.5 shadow-xs transition duration-300 hover:border-primary/20 hover:shadow-xs w-full">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <Link
            href={bookHref}
            className="block shrink-0 overflow-hidden rounded-lg w-11 aspect-[2/3] bg-muted relative"
          >
            <BookCoverImage
              src={book.coverImage}
              alt={book.title}
              fill
              className="object-cover"
              sizes="48px"
            />
          </Link>

          <div className="min-w-0 flex-1 pr-1">
            <Link href={bookHref}>
              <h3 className="line-clamp-1 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                {book.title}
              </h3>
            </Link>
            <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5">
              {book.author}
            </p>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1",
                  STATUS_STYLES[book.status],
                )}
              >
                {STATUS_LABELS[book.status]}
              </span>
              {book.isFavorite && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                  <Heart className="h-2.5 w-2.5 fill-current" />
                </span>
              )}
              {book.rating && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-200">
                  <Star className="h-3 w-3 fill-current text-amber-400" />
                  {book.rating}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 mr-4">
          {progressSection && (
            <div className="hidden sm:block w-28">{progressSection}</div>
          )}

          <div className="relative flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-bold px-3 gap-1"
            >
              <Link href={myReadingHref}>
                <BookOpen className="h-3.5 w-3.5" />
                <span>مطالعه من</span>
              </Link>
            </Button>

            {canManage && (
              <div className="relative" ref={menuRef}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="گزینه‌های بیشتر"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {menuOpen && (
                  <div className="absolute left-0 mt-1 w-32 origin-top-left rounded-xl border border-border/80 bg-card/95 p-1 shadow-lg z-20">
                    {book.format === "PHYSICAL" && <Link href={`/loans?bookId=${encodeURIComponent(book.id)}`} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-right text-xs text-foreground hover:bg-muted"><Handshake className="h-3.5 w-3.5" /> امانت دادن</Link>}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete?.(book);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-right text-xs text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>حذف کتاب</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col rounded-2xl border border-border/50 bg-card/40 shadow-xs transition duration-300 hover:border-primary/20 hover:shadow-sm">
      <Link href={bookHref} className="block overflow-hidden rounded-t-2xl">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <BookCoverImage
            src={book.coverImage}
            alt={book.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
          />

          <span
            className={cn(
              "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 backdrop-blur-xs",
              STATUS_STYLES[book.status],
            )}
          >
            {STATUS_LABELS[book.status]}
          </span>

          {book.isFavorite ? (
            <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/85 text-white">
              <Heart className="h-2.5 w-2.5 fill-current" />
            </span>
          ) : null}

          {book.rating ? (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur-xs">
              <Star className="h-3 w-3 fill-current text-amber-400" />
              {book.rating}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={bookHref} className="block">
          <h3 className="line-clamp-2 text-xs font-bold leading-5 text-foreground transition-colors group-hover:text-primary">
            {book.title}
          </h3>
        </Link>
        <p className="line-clamp-1 text-[11px] text-muted-foreground mb-2">
          {book.author}
        </p>

        {progressSection}

        <div className="relative mt-auto flex items-center gap-1.5 pt-1">
          <Button
            asChild
            size="sm"
            className="h-8 flex-1 gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[11px] font-bold"
          >
            <Link href={myReadingHref}>
              <BookOpen className="h-3.5 w-3.5" />
              <span>مطالعه من</span>
            </Link>
          </Button>

          {canManage && (
            <div className="relative" ref={menuRef}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen((open) => !open)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="گزینه‌های بیشتر"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {menuOpen && (
                <div className="absolute left-0 mt-1 w-32 origin-top-left rounded-xl border border-border/80 bg-card/95 p-1 shadow-lg z-20">
                  {book.format === "PHYSICAL" && <Link href={`/loans?bookId=${encodeURIComponent(book.id)}`} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-right text-xs text-foreground hover:bg-muted"><Handshake className="h-3.5 w-3.5" /> امانت دادن</Link>}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete?.(book);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-right text-xs text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    <span>حذف کتاب</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
