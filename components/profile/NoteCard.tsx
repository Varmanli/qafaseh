"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Heart,
} from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/lib/utils";
import BookCoverImage from "@/components/books/BookCoverImage";
import RichTextContent from "@/components/content/RichTextContent";
import { useCollapsibleContent } from "@/components/content/useCollapsibleContent";
import CardActionsMenu from "@/components/social/CardActionsMenu";
import { useEditedContent } from "@/components/social/useEditedContent";
import CommentCountLink from "@/components/social/CommentCountLink";
import { useSocialLike } from "@/components/social/useSocialLike";
import type { PublicNote } from "@/lib/notes/service";
import { AuthorChip, type CardManage } from "@/components/profile/QuoteCard";
import { richTextToPlainText } from "@/lib/content/rich-text";

export default function NoteCard({
  note: initialNote,
  canLike = false,
  showAuthor = false,
  showBook = true,
  showComments = true,
  showActions = true,
  detailPage = false,
  manage,
}: {
  note: PublicNote;
  canLike?: boolean;
  showAuthor?: boolean;
  showBook?: boolean;
  showComments?: boolean;
  showActions?: boolean;
  detailPage?: boolean;
  manage?: CardManage;
}) {
  const note = useEditedContent("NOTE", initialNote);
  const detailLink = useRef<HTMLAnchorElement>(null);
  const { liked, likeCount, pending: likePending, toggleLike: handleLike } = useSocialLike("NOTE", note.id, { liked: note.likedByViewer, likeCount: note.likeCount }, canLike);
  const [copied, setCopied] = useState(false);
  const {
    contentRef,
    isExpandable,
    isCollapsed: previewIsCollapsed,
  } = useCollapsibleContent();
  const isCollapsed = !detailPage && previewIsCollapsed;

  const bookHref = `/book/${encodeURIComponent(note.bookSlug || note.bookId)}`;
  const noteHref = `/note/${encodeURIComponent(note.id)}`;
  const noteText = richTextToPlainText(note.content);

  const created = new Date(note.createdAt).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
        ? `${window.location.origin}${noteHref}`
        : noteHref;

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
      toast.success("لینک یادداشت کپی شد");
    } catch {
      toast.error("اشتراک‌گذاری ممکن نشد");
    }
  }

  return (
    <article onClick={(event) => {
      if (detailPage || event.defaultPrevented || (event.target as HTMLElement).closest("a, button, input, textarea, select") || window.getSelection()?.toString()) return;
      event.stopPropagation();
      detailLink.current?.click();
    }} className={cn(detailPage ? "relative min-w-0 bg-transparent pt-4" : "relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-md transition-all hover:border-border/80 sm:p-5 cursor-pointer")}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {showAuthor && note.authorUsername ? (
              <AuthorChip
                username={note.authorUsername}
                name={note.authorName}
                image={note.authorImage}
              />
            ) : null}

            {showBook ? (
              <BookChip
                href={bookHref}
                cover={note.bookCover}
                title={note.bookTitle}
                author={note.bookAuthor}
              />
            ) : null}
          </div>

          <Link ref={detailLink} href={noteHref} prefetch={false} aria-label="مشاهدهٔ یادداشت و دیدگاه‌ها" className="inline-flex shrink-0 items-center gap-1.5 rounded text-[11px] tabular-nums text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary sm:justify-end">
            <CalendarDays className="h-3.5 w-3.5 opacity-75" aria-hidden="true" />
            <time dateTime={note.createdAt.toISOString()}>{created}</time>
          </Link>
        </header>

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

        {isExpandable && !detailPage ? (
          <div className="mt-3 border-t border-border/30 pt-2 text-center">
            <Link
              href={noteHref}
              prefetch={false}
              data-note-expand-toggle
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              بیشتر بخوانید
              <ChevronDown
                className="h-3.5 w-3.5"
              />
            </Link>
          </div>
        ) : null}

        {showActions ? <footer className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5">
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
                "inline-flex h-9 w-[68px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-0 text-xs font-bold tabular-nums transition-colors disabled:opacity-60",
                liked
                  ? "border-rose-300/20 bg-rose-500/10 text-rose-300"
                  : "border-border/50 text-muted-foreground hover:border-rose-300/20 hover:bg-rose-500/8 hover:text-rose-300",
              )}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              {likeCount.toLocaleString("fa-IR")}
            </button>

            {showComments ? <CommentCountLink targetType="NOTE" targetId={note.id} count={note.commentCount} className="h-9 w-[68px] min-w-0 shrink-0 gap-1.5 rounded-full px-0 text-xs" /> : null}
          </div>

          <CardActionsMenu note={note} copied={copied} onCopy={handleCopy} onShare={handleShare} manage={manage} />
        </footer> : null}

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
      className="group/book flex w-full min-w-0 max-w-full items-center gap-4 text-right sm:w-auto sm:gap-4"
    >
      <span className="relative aspect-[3/4] w-[60px] shrink-0 overflow-hidden rounded-[9px] bg-gradient-to-br from-primary/10 via-surface-2 to-surface-3 shadow-[0_10px_24px_-15px_rgba(0,0,0,0.8)] ring-1 ring-border/50 sm:w-[68px]">
        {cover ? (
          <BookCoverImage
            src={cover}
            alt={title}
            fill
            sizes="(max-width: 640px) 60px, 68px"
            className="object-cover transition-transform duration-200 group-hover/book:scale-[1.03]"
          />
        ) : (
          <span aria-hidden="true" className="absolute inset-y-1.5 start-1.5 w-1 rounded-full bg-primary/25" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-black leading-7 text-foreground sm:max-w-[260px] sm:text-base">
          {title}
        </span>

        {author ? (
          <span className="mt-0.5 block truncate text-sm leading-6 text-muted-foreground sm:max-w-[260px] sm:text-[13px]">
            {author}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
