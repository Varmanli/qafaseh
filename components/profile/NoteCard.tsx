"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Check,
  Copy,
  Heart,
  NotebookPen,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/lib/utils";
import BookCoverImage from "@/components/books/BookCoverImage";
import RichTextContent from "@/components/content/RichTextContent";
import { useCollapsibleContent } from "@/components/content/useCollapsibleContent";
import type { PublicNote } from "@/lib/notes/service";
import { AuthorChip, type CardManage } from "@/components/profile/QuoteCard";
import { richTextToPlainText } from "@/lib/content/rich-text";

const PLACEHOLDER = "/placeholder-cover.svg";

export default function NoteCard({
  note,
  canLike = false,
  showAuthor = false,
  showBook = true,
  manage,
}: {
  note: PublicNote;
  canLike?: boolean;
  showAuthor?: boolean;
  showBook?: boolean;
  manage?: CardManage;
}) {
  const [liked, setLiked] = useState(note.likedByViewer);
  const [likeCount, setLikeCount] = useState(note.likeCount);
  const [likePending, setLikePending] = useState(false);
  const [copied, setCopied] = useState(false);
  const {
    contentRef,
    isExpandable,
    isExpanded,
    isCollapsed,
    toggleExpanded,
  } = useCollapsibleContent();

  const bookHref = `/book/${encodeURIComponent(note.bookSlug || note.bookId)}`;
  const noteText = richTextToPlainText(note.content);

  const created = new Date(note.createdAt).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleLike() {
    if (!canLike) {
      toast("برای پسندیدن وارد شوید");
      return;
    }

    if (likePending) return;

    const nextLiked = !liked;

    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    setLikePending(true);

    try {
      const res = await fetch(`/api/notes/${note.id}/like`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("like failed");

      const data = (await res.json()) as {
        liked: boolean;
        likeCount: number;
      };

      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      setLiked(!nextLiked);
      setLikeCount((count) => count + (nextLiked ? -1 : 1));
      toast.error("پسند ثبت نشد");
    } finally {
      setLikePending(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(noteText);
      setCopied(true);
      toast.success("یادداشت کپی شد");
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("کپی نشد");
    }
  }

  async function handleShare() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${bookHref}`
        : bookHref;

    const shareData = {
      title: note.bookTitle,
      text: `${noteText} — ${note.bookTitle}`,
      url,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        return;
      }

      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("لینک کتاب کپی شد");
    } catch {
      toast.error("اشتراک‌گذاری ممکن نشد");
    }
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-md transition-all hover:border-border/80 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {showAuthor && note.authorUsername ? (
              <AuthorChip
                username={note.authorUsername}
                name={note.authorName}
                image={note.authorImage}
              />
            ) : (
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300 ring-1 ring-sky-300/20">
                <NotebookPen className="h-4 w-4" />
              </span>
            )}

            {showBook ? (
              <BookChip
                href={bookHref}
                cover={note.bookCover}
                title={note.bookTitle}
                author={note.bookAuthor}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {created}
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleLike();
              }}
              disabled={likePending}
              aria-pressed={liked}
              aria-label={liked ? "برداشتن پسند" : "پسندیدن"}
              className={cn(
                "inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-xl border px-2 text-[11px] font-bold tabular-nums transition-all disabled:opacity-60",
                liked
                  ? "border-rose-300/15 bg-rose-500/12 text-rose-300"
                  : "border-border/60 bg-background/50 text-muted-foreground hover:border-rose-300/20 hover:bg-rose-500/10 hover:text-rose-300",
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
              {likeCount.toLocaleString("fa-IR")}
            </button>

            <div className="flex items-center gap-0.5">
              <NoteIconAction
                label="کپی یادداشت"
                onClick={handleCopy}
                active={copied}
                icon={
                  copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              />

              <NoteIconAction
                label="اشتراک‌گذاری"
                onClick={handleShare}
                icon={<Share2 className="h-3.5 w-3.5" />}
              />

              {manage ? (
                <>
                  <span className="mx-0.5 h-4 w-px bg-border/60" />

                  <NoteIconAction
                    label="ویرایش"
                    onClick={manage.onEdit}
                    tone="primary"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  />

                  <NoteIconAction
                    label="حذف"
                    onClick={manage.onDelete}
                    tone="danger"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "relative mt-4 transition-all duration-300",
            isCollapsed
              ? "max-h-24 overflow-hidden"
              : "max-h-none overflow-visible",
          )}
        >
          <div ref={contentRef}>
            <RichTextContent
              content={note.content}
              className="break-words text-right text-xs leading-relaxed text-foreground/90 [overflow-wrap:anywhere] sm:text-sm sm:leading-7 [&_a]:break-all [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-r-2 [&_blockquote]:border-primary/30 [&_blockquote]:pr-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pr-5 [&_p]:mb-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pr-5"
            />
          </div>

          {isCollapsed ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card/90 via-card/50 to-transparent" />
          ) : null}
        </div>

        {isExpandable ? (
          <div className="mt-3 border-t border-border/30 pt-2 text-center">
            <button
              type="button"
              data-note-expand-toggle
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {isExpanded ? "نمایش کمتر" : "بیشتر بخوانید"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  isExpanded && "rotate-180",
                )}
              />
            </button>
          </div>
        ) : null}

    </article>
  );
}

function BookChip({
  href,
  cover,
  title,
  author,
}: {
  href: string;
  cover: string | null;
  title: string;
  author: string | null;
}) {
  return (
    <Link
      href={href}
      onClick={(event) => event.stopPropagation()}
      className="flex min-w-0 items-center gap-2 rounded-2xl border border-border/80 bg-background/35 py-1 pe-3 ps-1.5 transition-colors hover:border-sky-300/25 hover:bg-sky-300/[0.035]"
    >
      <span className="relative aspect-[3/4] w-8 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
        <BookCoverImage
          src={cover || PLACEHOLDER}
          alt={title}
          fill
          sizes="32px"
          className="object-cover"
        />
      </span>

      <span className="min-w-0">
        <span className="block max-w-[190px] truncate text-xs font-black text-foreground">
          {title}
        </span>

        {author ? (
          <span className="mt-0.5 block max-w-[190px] truncate text-[10px] text-muted-foreground">
            {author}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function NoteIconAction({
  label,
  icon,
  onClick,
  active,
  tone = "default",
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  tone?: "default" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-xl border text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/25",
        active
          ? "border-sky-300/25 bg-sky-400/10 text-sky-300"
          : "border-transparent bg-transparent hover:border-border/80 hover:bg-white/[0.05]",
        tone === "primary" &&
          "text-sky-300 hover:border-sky-300/25 hover:bg-sky-400/10",
        tone === "danger" &&
          "text-red-300/85 hover:border-red-300/20 hover:bg-red-500/10 hover:text-red-300",
      )}
    >
      {icon}
    </button>
  );
}
