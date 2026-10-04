"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import toast from "react-hot-toast";

import BookCoverImage from "@/components/books/BookCoverImage";
import QuoteCard from "@/components/profile/QuoteCard";
import NoteCard from "@/components/profile/NoteCard";
import ActivityActions from "@/components/social/ActivityActions";
import CardActionsMenu from "@/components/social/CardActionsMenu";
import { useEditedContent } from "@/components/social/useEditedContent";
import { activityText } from "@/lib/social/activity-labels";
import CommentsSection from "@/components/social/CommentsSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { getFollowingFeed } from "@/lib/social/activity";
import { cn } from "@/lib/utils";
import { richTextToPlainText } from "@/lib/content/rich-text";
import { socialDetailHref } from "@/lib/social/detail-href";
import type { PublicQuote } from "@/lib/quotes/service";
import type { PublicNote } from "@/lib/notes/service";

type FeedPage = Awaited<ReturnType<typeof getFollowingFeed>>;
type FeedItem = FeedPage["items"][number];

export function ActivityCard({ item: initialItem, canComment = true, detailPage = false, preview = false, stretch = false, showComments = true }: { item: FeedItem; canComment?: boolean; detailPage?: boolean; preview?: boolean; stretch?: boolean; showComments?: boolean }) {
  const quote = useEditedContent("QUOTE", initialItem.quote);
  const note = useEditedContent("NOTE", initialItem.note);
  const item = { ...initialItem, quote, note };
  const detailLink = useRef<HTMLAnchorElement>(null);
  const actor = item.actorName?.trim() || item.actorUsername || "کتاب‌خوان";
  const profileHref = `/${encodeURIComponent(item.actorUsername || "")}`;
  const isNote = item.type === "PUBLISHED_NOTE" || item.type === "LIKED_NOTE";
  const isQuote = item.type === "PUBLISHED_QUOTE" || item.type === "LIKED_QUOTE";
  const text = activityText[item.type];
  const detailHref = socialDetailHref(item.commentTarget);
  const action = <>{text.before} «<span className="font-medium text-foreground">{item.bookTitle}</span>» {text.after}</>;

  return (
    <li className={cn("min-w-0 list-none", preview && stretch && "lg:h-full")}>
      <article dir="rtl" onClick={(event) => {
        if (detailPage || event.defaultPrevented || (event.target as HTMLElement).closest("a, button, input, textarea, select") || window.getSelection()?.toString()) return;
        detailLink.current?.click();
      }} className={cn("flex min-w-0 flex-col rounded-3xl border border-border/60 bg-card/45 p-4 sm:p-5", detailPage && !showComments && "rounded-none border-0 bg-transparent p-0 sm:p-0", !detailPage && "cursor-pointer", preview && stretch && "lg:h-full", preview && "lg:rounded-2xl lg:p-4")}>
        <Link href={item.bookHref} className={cn("group/book flex min-w-0 items-center gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:gap-5", detailPage && "gap-3 sm:gap-3")}>
          <BookCoverImage src={item.bookCover} alt={`جلد ${item.bookTitle}`} width={88} height={132} sizes={detailPage ? "(max-width: 640px) 56px, 64px" : preview ? "(min-width: 1024px) 56px, (max-width: 640px) 76px, 88px" : "(max-width: 640px) 76px, 88px"} className={cn("h-[114px] w-[76px] shrink-0 rounded-lg bg-surface-3 object-cover shadow-sm ring-1 ring-border/40 sm:h-[132px] sm:w-[88px]", preview && "lg:h-[84px] lg:w-14", detailPage && "h-[84px] w-14 sm:h-24 sm:w-16")} />
          <div className="min-w-0 flex-1">
            <h3 className={cn("break-words text-base font-black leading-7 text-foreground transition-colors group-hover/book:text-primary sm:text-lg", preview && "lg:text-base", detailPage && "text-sm leading-6 sm:text-base")}>{item.bookTitle}</h3>
            {item.bookAuthor ? <p className={cn("mt-1 break-words text-sm leading-6 text-muted-foreground", detailPage && "text-xs leading-5 sm:text-sm")}>{item.bookAuthor}</p> : null}
            {!detailPage && item.bookTranslator ? <p className={cn("mt-2 hidden break-words text-xs leading-5 text-muted-foreground sm:block", preview && "lg:hidden")}>ترجمهٔ {item.bookTranslator}</p> : null}
            {!detailPage && (item.bookPublisher || item.bookPageCount) ? (
              <p className={cn("mt-1 hidden flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-muted-foreground/80 sm:flex sm:text-xs", preview && "lg:hidden")}>
                {item.bookPublisher ? <span>{item.bookPublisher}</span> : null}
                {item.bookPublisher && item.bookPageCount ? <span aria-hidden="true">·</span> : null}
                {item.bookPageCount ? <span>{item.bookPageCount.toLocaleString("fa-IR")} صفحه</span> : null}
              </p>
            ) : null}
          </div>
          {!detailPage ? <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover/book:text-primary" aria-hidden="true" /> : null}
        </Link>

        <div className={cn("mt-4 flex items-start gap-2.5 border-t border-border/40 pt-4 sm:mt-5 sm:pt-5", preview && "lg:hidden", detailPage && !showComments && "-order-1 mb-5 mt-0 border-b border-t-0 pb-4 pt-0 sm:mt-0 sm:pt-0 lg:order-none lg:mb-0 lg:mt-5 lg:border-b-0 lg:border-t lg:pb-0 lg:pt-5")}>
          <Link href={profileHref} aria-label={`پروفایل ${actor}`} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <Avatar className="size-8 ring-2 ring-background">
              {item.actorImage ? <AvatarImage src={item.actorImage} alt={actor} /> : null}
              <AvatarFallback className="bg-surface-3 text-sm text-primary-deep">{actor.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className={cn("min-w-0 flex-1 text-xs leading-6 sm:text-sm sm:leading-7", preview && "lg:text-xs lg:leading-6")}>
            <Link href={profileHref} className="font-bold text-foreground hover:text-primary">{actor}</Link>{" "}
            <span className="text-muted-foreground">{action}</span>
            <Link ref={detailLink} href={detailHref} prefetch={false} aria-label="مشاهدهٔ محتوا و دیدگاه‌ها" className="mt-1 block text-[11px] text-muted-foreground/80 hover:text-primary"><time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}
            </time></Link>
          </div>
        </div>

        {isQuote && item.quote ? (
          <div className={cn("min-w-0", preview && "lg:hidden")}>
            <QuoteCard quote={item.quote} canLike={canComment} showBook={false} showAuthor={item.type === "LIKED_QUOTE"} background={item.quote.background} detailPage={detailPage} flat={detailPage} showActions={false} className={cn("mt-4 h-auto min-h-0 sm:min-h-0", detailPage && "rounded-none bg-transparent p-0 shadow-none")} />
          </div>
        ) : null}

        {isNote && item.note ? (
          <div className={cn("mt-4 min-w-0", preview && "lg:hidden")}>
            <NoteCard note={{ ...item.note, createdAt: new Date(item.note.createdAt) }} canLike={canComment} showBook={false} showActions={false} showAuthor={item.type === "LIKED_NOTE"} />
          </div>
        ) : null}
        {preview ? (
          <div className="mt-4 hidden items-start gap-3 rounded-xl border border-border/50 bg-background/30 p-3.5 lg:flex">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-6 text-foreground">
                <Link href={profileHref} className="hover:text-primary">{actor}</Link>{" "}{text.profileAction}
              </p>
              <time dateTime={item.createdAt} className="mt-1 block text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </div>
          </div>
        ) : null}
        {preview && (item.quote || item.note) ? (
          <Link href={detailHref} prefetch={false} className="group/preview hidden min-w-0 items-start gap-2 border-r-2 border-primary/35 pr-3 transition-colors hover:border-primary lg:my-3.5 lg:flex">
            <span className="min-w-0 flex-1">
              <span dir="auto" className="line-clamp-2 block break-words text-sm leading-6 text-foreground/90">{item.quote ? item.quote.content || "تکه‌ای تصویری از کتاب" : richTextToPlainText(item.note!.content)}</span>
              <span className="mt-1.5 block text-xs font-bold text-primary">مشاهده</span>
            </span>
          </Link>
        ) : null}
        <footer className={cn("mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3", preview && "lg:justify-end")}>
          {item.quote || item.note ? <ContentUtilityActions content={item.quote?.content || (item.note ? richTextToPlainText(item.note.content) : "")} title={item.bookTitle} href={detailHref} quote={item.quote ?? undefined} note={item.note ? { ...item.note, createdAt: new Date(item.note.createdAt) } : undefined} /> : <span className={cn("text-[11px] font-medium text-muted-foreground", (preview || detailPage) && "hidden")}>{text.label}</span>}
          <div className="flex items-center gap-1.5">
            <ActivityActions likeCount={item.likeCount} likedByViewer={item.likedByViewer} commentCount={item.commentCount} commentTarget={item.commentTarget} canLike={canComment} className="mt-0" />
          </div>
        </footer>
        {detailPage && showComments ? <CommentsSection targetType={item.commentTarget.type} targetId={item.commentTarget.id} canComment={canComment} defaultOpen /> : null}
      </article>
    </li>
  );
}

function ContentUtilityActions({ content, title, href, quote, note }: { content: string; title: string; href: string; quote?: PublicQuote; note?: PublicNote }) {
  const [copied, setCopied] = useState(false);

  async function copyContent() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success("متن کپی شد");
    } catch {
      toast.error("کپی متن انجام نشد");
    }
  }

  async function shareActivity() {
    const url = `${window.location.origin}${href}`;
    try {
      if (navigator.share) await navigator.share({ title, text: content, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("پیوند محتوا کپی شد");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") toast.error("اشتراک‌گذاری انجام نشد");
    }
  }

  return <CardActionsMenu quote={quote} note={note} copied={copied} canCopy={!!content} onCopy={copyContent} onShare={shareActivity} />;
}

function EmptyFeed({ followingCount }: { followingCount: number }) {
  return (
    <div className="py-24 text-center sm:py-32">
      <h2 className="text-lg font-bold text-foreground">
        {followingCount ? "هنوز فعالیتی نیست" : "فیدت هنوز خالی است"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
        {followingCount ? "فعالیت‌های تازهٔ کتاب‌خوان‌هایی که دنبال می‌کنی اینجا نمایش داده می‌شود." : "چند کتاب‌خوان را دنبال کن تا فعالیت‌هایشان را اینجا ببینی."}
      </p>
      {!followingCount ? <Button asChild variant="outline" className="mt-4 h-9 rounded-lg"><Link href="/search?tab=users">پیدا کردن کتاب‌خوان‌ها</Link></Button> : null}
    </div>
  );
}

export default function FeedTimeline({ initialPage, followingCount }: { initialPage: FeedPage; followingCount: number }) {
  const [items, setItems] = useState(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
      if (!response.ok) throw new Error("FEED_FAILED");
      const page = await response.json() as FeedPage;
      setItems((previous) => [...previous, ...page.items.filter((item) => !previous.some((existing) => existing.id === item.id))]);
      setCursor(page.nextCursor);
    } catch {
      toast.error("دریافت فعالیت‌ها ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="فعالیت‌های دنبال‌شده‌ها" className="min-w-0">
      {items.length ? (
        <>
          <ol className="space-y-4 sm:space-y-5">{items.map((item) => <ActivityCard key={item.id} item={item} />)}</ol>
          {cursor ? <div className="pt-8 text-center"><Button variant="ghost" className="h-10 rounded-full px-6 text-sm text-muted-foreground hover:text-foreground" disabled={loading} onClick={loadMore}>{loading ? "در حال بارگذاری..." : "نمایش بیشتر"}</Button></div> : null}
        </>
      ) : <EmptyFeed followingCount={followingCount} />}
    </section>
  );
}
