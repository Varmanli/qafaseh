"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  Heart,
  Quote as QuoteIcon,
  Star,
} from "lucide-react";
import toast from "react-hot-toast";

import BookCoverImage from "@/components/books/BookCoverImage";
import CardActionsMenu from "@/components/social/CardActionsMenu";
import { useEditedContent } from "@/components/social/useEditedContent";
import CommentCountLink from "@/components/social/CommentCountLink";
import { useSocialLike } from "@/components/social/useSocialLike";
import type { PublicQuote } from "@/lib/quotes/service";
import { cn } from "@/lib/utils";
import { getQuoteDirectionProps } from "@/lib/text-direction";
import type { QuoteBackground as QuoteBackgroundVariant } from "@/lib/quotes/backgrounds";
import { QuoteBackground } from "@/components/quotes/QuoteBackground";
export { QuoteBackground } from "@/components/quotes/QuoteBackground";

const PLACEHOLDER = "/placeholder-cover.svg";

export interface CardManage {
  onEdit: () => void;
  onDelete: () => void;
}

interface QuoteCardProps {
  quote: PublicQuote;
  canLike: boolean;
  showAuthor?: boolean;
  showBook?: boolean;
  manage?: CardManage;
  background?: QuoteBackgroundVariant;
  className?: string;
  priority?: boolean;
  detailPage?: boolean;
  flat?: boolean;
  showActions?: boolean;
  showComments?: boolean;
}

export default function QuoteCard({
  quote: initialQuote,
  canLike,
  showAuthor = false,
  showBook = true,
  manage,
  background = "default",
  className,
  priority = false,
  detailPage = false,
  flat = false,
  showActions = true,
  showComments = true,
}: QuoteCardProps) {
  const quote = useEditedContent("QUOTE", initialQuote);
  const { liked, likeCount, pending: likePending, toggleLike: handleLike } = useSocialLike("QUOTE", quote.id, { liked: quote.likedByViewer, likeCount: quote.likeCount }, canLike);
  const [copied, setCopied] = useState(false);

  const bookHref = `/book/${encodeURIComponent(
    quote.bookSlug || quote.bookId,
  )}`;
  const quoteHref = `/quote/${encodeURIComponent(quote.id)}`;

  const quoteText = quote.content?.trim() || "";
  const fallbackText = `تکه‌ای تصویری از کتاب «${quote.bookTitle}»`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(quoteText);

      setCopied(true);
      toast.success("تکه کتاب کپی شد");

      window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      toast.error("کپی نشد");
    }
  }

  async function handleShare() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${quoteHref}`
        : quoteHref;

    const shareData = {
      title: quote.bookTitle,
      text: quoteText ? `«${quoteText}» — ${quote.bookTitle}` : fallbackText,
      url,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // The share sheet may be intentionally closed.
      }

      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("لینک تکهٔ کتاب کپی شد");
    } catch {
      toast.error("اشتراک‌گذاری ممکن نشد");
    }
  }

  return (
    <>
      <article
        dir="rtl"
        className={cn(
          flat
            ? "relative flex min-h-0 flex-col overflow-hidden bg-transparent p-0 shadow-none"
            : "group relative flex h-full min-h-[390px] flex-col overflow-hidden rounded-[1.75rem] border border-border/65 bg-card/80 p-3.5 shadow-md transition-colors duration-150 hover:border-primary/20 hover:bg-card/90 hover:shadow-md sm:min-h-[420px] sm:p-4 sm:shadow-[0_22px_65px_-48px_rgba(0,0,0,0.75)] sm:transition-[border-color,background-color,box-shadow] sm:duration-300 sm:hover:shadow-[0_28px_72px_-50px_rgba(0,0,0,0.85)]",
          className,
        )}
      >
        {/* top highlight */}
        {!flat ? <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        /> : null}

        {/* Author */}
        {showAuthor && quote.authorUsername ? (
          <AuthorHeader
            username={quote.authorUsername}
            name={quote.authorName}
            image={quote.authorImage}
          />
        ) : null}

        {/* Book */}
        {showBook ? (
          <BookHeader
            href={bookHref}
            cover={quote.bookCover}
            title={quote.bookTitle}
            author={quote.bookAuthor}
            priority={priority}
          />
        ) : null}

        {/* Quote */}
        <QuoteContent
          quoteText={quoteText}
          imageKey={quote.imageKey}
          bookTitle={quote.bookTitle}
          page={quote.page}
          background={quote.background || background}
          href={detailPage ? undefined : quoteHref}
          priority={priority}
          flat={flat}
        />

        {/* Actions */}
        {showActions ? <QuoteCardFooter
          liked={liked}
          likeCount={likeCount}
          commentCount={quote.commentCount}
          quoteId={quote.id}
          showComments={showComments && !detailPage}
          likePending={likePending}
          copied={copied}
          manage={manage}
          quote={quote}
          onLike={handleLike}
          onCopy={handleCopy}
          canCopy={Boolean(quoteText)}
          onShare={handleShare}
        /> : null}
      </article>

    </>
  );
}

function AuthorHeader({
  username,
  name,
  image,
}: {
  username: string;
  name: string | null;
  image: string | null;
}) {
  const displayName = name || `@${username}`;
  const initial = displayName.trim().charAt(0) || "؟";

  return (
    <Link
      href={`/${username}`}
      onClick={(event) => event.stopPropagation()}
      className="
        group/author
        relative
        z-10
        flex
        min-w-0
        items-center
        gap-3
        pb-3
      "
    >
      {/* Avatar — right side in RTL */}
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border/70 bg-secondary text-xs font-black text-foreground shadow-sm sm:h-12 sm:w-12">
        {image ? (
          <Image
            src={image}
            alt={displayName}
            width={48}
            height={48}
            className="h-full w-full object-cover"
            loading="lazy"
            unoptimized
          />
        ) : (
          <span>{initial}</span>
        )}
      </span>

      <span className="min-w-0 text-right">
        <span className="block max-w-[190px] truncate text-[13px] font-black text-foreground transition-colors group-hover/author:text-primary sm:text-sm">
          {displayName}
        </span>

        {name ? (
          <span
            dir="ltr"
            className="mt-0.5 block max-w-[190px] truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]"
          >
            @{username}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function BookHeader({
  href,
  cover,
  title,
  author,
  rating,
  priority = false,
}: {
  href: string;
  cover: string | null;
  title: string;
  author: string | null;
  rating?: number | null;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={(event) => event.stopPropagation()}
      className="
        group/book
        relative
        z-10
        flex
        min-w-0
        items-center
        gap-4
        py-1
      "
    >
      <span
        className="
          relative
          h-[6rem]
          w-[4.15rem]
          shrink-0
          overflow-hidden
          rounded-[4px]
          bg-muted
          shadow-[0_14px_28px_-16px_rgba(0,0,0,0.75)]
          ring-1
          ring-border/40
          sm:h-[6.5rem]
          sm:w-[4.5rem]
        "
      >
        <BookCoverImage
          src={cover || PLACEHOLDER}
          alt={title}
          fill
          sizes="(max-width: 768px) 72px, 76px"
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover/book:scale-[1.025]"
        />
      </span>

      <span className="min-w-0 flex-1 text-right">
        <span className="block truncate text-[15px] font-black leading-7 text-foreground transition-colors group-hover/book:text-primary sm:text-base">
          {title}
        </span>

        {author ? (
          <span className="mt-0.5 block truncate text-xs font-medium leading-5 text-muted-foreground sm:text-[13px]">
            {author}
          </span>
        ) : null}

        {typeof rating === "number" ? (
          <span className="mt-1.5 flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />

            <span className="tabular-nums text-foreground/85">
              {rating.toLocaleString("fa-IR", {
                maximumFractionDigits: 1,
              })}
            </span>

            <span className="text-[10px] font-medium text-muted-foreground/70">
              از ۵
            </span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function QuoteContent({
  quoteText,
  imageKey,
  bookTitle,
  page,
  background,
  href,
  priority = false,
  flat = false,
}: {
  quoteText: string;
  imageKey: string | null;
  bookTitle: string;
  page: number | null;
  background: QuoteBackgroundVariant;
  href?: string;
  priority?: boolean;
  flat?: boolean;
}) {
  const hasArtwork = background !== "default";
  const canOpen = !!href;
  const containerClass = cn(
        "relative z-10 mt-3 flex min-h-0 flex-1 overflow-hidden",
        flat ? "rounded-2xl border-0 bg-transparent shadow-none" : "rounded-[1.45rem] border",
        !flat && (hasArtwork ? "border-white/10 bg-black" : "border-border/60 bg-background/30"),
        !flat && "shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]",
        canOpen &&
          "cursor-pointer transition-[border-color,box-shadow] duration-300",
        canOpen &&
          (hasArtwork
            ? "hover:border-white/20 hover:shadow-[0_18px_46px_-34px_rgba(0,0,0,0.9)]"
            : "hover:border-primary/15"),
        canOpen &&
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
      );
  const content = (
    <>
      {/* Background belongs ONLY to the quote area. */}
      {!flat || hasArtwork ? <QuoteBackground variant={background} /> : null}

      {/* Decorative quote marks */}
      <QuoteIcon
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-4 top-4 z-[1] h-7 w-7 sm:right-5 sm:top-5 sm:h-8 sm:w-8",
          hasArtwork ? "text-white/35" : "text-primary/25",
        )}
      />

      <QuoteIcon
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-4 left-4 z-[1] h-7 w-7 rotate-180 sm:bottom-5 sm:left-5 sm:h-8 sm:w-8",
          hasArtwork ? "text-white/15" : "text-primary/10",
        )}
      />

      <div className={cn("relative z-10 flex w-full flex-1 flex-col", flat ? "min-h-[180px] px-4 py-9 sm:min-h-[200px] sm:px-8 sm:py-10" : "min-h-[205px] px-5 py-6 sm:min-h-[230px] sm:px-7 sm:py-7")}>
        {imageKey ? (
          <div
            className={cn(
              "relative mb-4 flex min-h-32 w-full items-center justify-center overflow-hidden rounded-xl",
              canOpen ? "max-h-48" : "max-h-[70dvh]",
              hasArtwork
                ? "bg-black/25 ring-1 ring-white/15 backdrop-blur-[2px]"
                : "bg-black/10 ring-1 ring-border/40",
            )}
          >
            <BookCoverImage
              src={imageKey}
              alt={`تصویر تکه‌ای از کتاب «${bookTitle}»`}
              width={350}
              height={450}
              priority={priority}
              sizes="(max-width: 768px) 280px, 350px"
              className={cn("h-auto w-auto max-w-full object-contain", canOpen ? "max-h-48" : "max-h-[70dvh]")}
            />
          </div>
        ) : null}

        {quoteText ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="mx-auto w-full max-w-[34rem]">
              <p
                {...getQuoteDirectionProps(quoteText)}
                className={cn(
                  "whitespace-pre-line break-words text-center [overflow-wrap:anywhere]",
                  "text-[13px] font-medium leading-7",
                  hasArtwork
                    ? "text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.55)]"
                    : "text-foreground/95",
                  "sm:text-[15px] sm:leading-[2.2]",
                  "md:text-[1rem] md:leading-[2.3]",
                  "lg:text-base lg:leading-[2.4]",
                  canOpen && "line-clamp-6",
                  flat && "text-base leading-9 sm:text-lg sm:leading-10 md:text-lg md:leading-10 lg:text-lg lg:leading-10",
                )}
              >
                {quoteText}
              </p>
            </div>
          </div>
        ) : null}

        {page ? (
          <div className="mt-4 flex min-h-8 shrink-0 items-center justify-end">
            <PageBadge page={page} inverted={hasArtwork} />
          </div>
        ) : null}
      </div>
    </>
  );
  return href
    ? <Link href={href} prefetch={false} className={containerClass} aria-label="مشاهده کامل تکه کتاب">{content}</Link>
    : <div className={containerClass}>{content}</div>;
}

function QuoteCardFooter({
  liked,
  likeCount,
  commentCount,
  quoteId,
  showComments,
  likePending,
  copied,
  manage,
  quote,
  onLike,
  onCopy,
  canCopy,
  onShare,
}: {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  quoteId: string;
  showComments: boolean;
  likePending: boolean;
  copied: boolean;
  manage?: CardManage;
  quote: PublicQuote;
  onLike: () => void;
  onCopy: () => void;
  canCopy: boolean;
  onShare: () => void;
}) {
  return (
    <footer className="relative z-10 mt-3 flex shrink-0 items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <LikePill
          liked={liked}
          count={likeCount}
          pending={likePending}
          onClick={onLike}
        />
        {showComments ? <CommentCountLink targetType="QUOTE" targetId={quoteId} count={commentCount} /> : null}
      </div>

      <CardActionsMenu quote={quote} copied={copied} canCopy={canCopy} onCopy={onCopy} onShare={onShare} manage={manage} />
    </footer>
  );
}

function PageBadge({
  page,
  inverted = false,
}: {
  page: number;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium tabular-nums",
        inverted ? "text-white/75" : "text-muted-foreground",
      )}
    >
      <BookOpen className="h-3.5 w-3.5 opacity-70" />
      صفحه {page.toLocaleString("fa-IR")}
    </span>
  );
}

function LikePill({
  liked,
  count,
  pending,
  onClick,
}: {
  liked: boolean;
  count: number;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      className={cn(
        "inline-flex h-10 min-w-[68px] items-center justify-center gap-2 rounded-full",
        "border border-border/60 bg-background/30 px-3",
        "text-xs font-black tabular-nums",
        "transition-[border-color,background-color,color] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        "disabled:cursor-not-allowed disabled:opacity-60",
        liked
          ? "border-rose-400/15 bg-rose-500/10 text-rose-400"
          : "text-muted-foreground hover:border-rose-400/15 hover:bg-rose-500/8 hover:text-rose-400",
      )}
    >
      <Heart
        className={cn(
          "h-[17px] w-[17px] transition-transform duration-200",
          liked && "scale-110 fill-current",
        )}
      />

      <span>{count.toLocaleString("fa-IR")}</span>
    </button>
  );
}

export function AuthorChip({
  username,
  name,
  image,
}: {
  username: string;
  name: string | null;
  image: string | null;
}) {
  const displayName = name || `@${username}`;
  const initial = displayName.trim().charAt(0) || "؟";

  return (
    <Link
      href={`/${username}`}
      onClick={(event) => event.stopPropagation()}
      className="group/author flex min-w-0 items-center gap-2.5"
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border/70 bg-secondary text-xs font-black text-foreground shadow-sm">
        {image ? (
          <Image
            src={image}
            alt={displayName}
            width={36}
            height={36}
            className="h-full w-full object-cover"
            loading="lazy"
            unoptimized
          />
        ) : (
          <span>{initial}</span>
        )}
      </span>

      <span className="min-w-0 text-right">
        <span className="block max-w-[150px] truncate text-[11px] font-black text-foreground transition-colors group-hover/author:text-primary">
          {displayName}
        </span>

        {name ? (
          <span
            dir="ltr"
            className="mt-0.5 block max-w-[150px] truncate text-[10px] font-medium text-muted-foreground"
          >
            @{username}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
