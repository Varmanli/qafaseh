import { Activity } from "lucide-react";
import Link from "next/link";

import HomeSectionHeader from "@/components/home/HomeSectionHeader";
import BookCoverImage from "@/components/books/BookCoverImage";
import ActivityActions from "@/components/social/ActivityActions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { getFollowingFeed } from "@/lib/social/activity";
import { activityText } from "@/lib/social/activity-labels";
import { ActivityCard } from "@/components/feed/FeedTimeline";
import { socialDetailHref } from "@/lib/social/detail-href";

type ActivityItems = Awaited<ReturnType<typeof getFollowingFeed>>["items"];
type ActivityItem = ActivityItems[number];

export default function HomeRecentActivity({ items, variant = "home", canLike = false, username }: { items: ActivityItems; variant?: "home" | "profile"; canLike?: boolean; username?: string }) {
  if (!items.length && variant === "home") return null;

  return (
    <section dir="rtl" aria-label="فعالیت‌های اخیر" className="min-w-0">
      {variant === "profile" ? (
        <div className="mb-5 flex items-center justify-between gap-3 px-1 sm:mb-7">
          <h2 className="text-base font-black tracking-tight text-foreground sm:text-xl">فعالیت‌های اخیر</h2>
          {username ? <Link href={`/${encodeURIComponent(username)}/activity`} className="shrink-0 text-xs font-bold text-primary transition-colors hover:text-primary/80 sm:text-sm">نمایش همه</Link> : null}
        </div>
      ) : (
        <HomeSectionHeader icon={Activity} title="فعالیت‌های اخیر" href="/feed" linkLabel="دیدن همه" compact />
      )}

      {!items.length ? <p className="py-4 text-center text-xs leading-6 text-muted-foreground sm:text-sm">هنوز فعالیتی ثبت نشده است.</p> : null}

      {variant === "home" ? (
        <ol className="divide-y divide-border/50">
          {items.map((item) => <HomeActivityRow key={item.id} item={item} canLike={canLike} />)}
        </ol>
      ) : (
        <ul className="grid min-w-0 items-stretch gap-4 lg:grid-cols-3 lg:gap-5">
          {items.map((item) => <ActivityCard key={item.id} item={item} canComment={canLike} preview stretch />)}
        </ul>
      )}
    </section>
  );
}

function HomeActivityRow({ item, canLike }: { item: ActivityItem; canLike: boolean }) {
  const actor = item.actorName?.trim() || item.actorUsername || "کتاب‌خوان";
  const profileHref = `/${encodeURIComponent(item.actorUsername || "")}`;
  const activityHref = socialDetailHref(item.commentTarget);
  const text = activityText[item.type];

  return (
    <li className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:first:pt-1 sm:last:pb-1">
      <Link href={item.bookHref} aria-label={`مشاهدهٔ کتاب ${item.bookTitle}`} className="group/book row-span-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:row-span-1">
        <BookCoverImage src={item.bookCover} alt={`جلد ${item.bookTitle}`} width={44} height={66} sizes="44px" className="h-[66px] w-11 rounded-lg bg-surface-3 object-cover shadow-sm ring-1 ring-border/50 transition-transform group-hover/book:-translate-y-0.5" />
      </Link>

      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Link href={profileHref} aria-label={`پروفایل ${actor}`} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <Avatar className="size-8 ring-1 ring-border/50">
            {item.actorImage ? <AvatarImage src={item.actorImage} alt={actor} /> : null}
            <AvatarFallback className="bg-surface-3 text-xs font-bold text-primary-deep">{actor.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={activityHref} prefetch={false} className="group/activity block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <p className="line-clamp-3 break-words text-xs leading-6 text-muted-foreground transition-colors group-hover/activity:text-foreground sm:line-clamp-2 sm:text-sm">
              <span className="font-bold text-foreground">{actor}</span>{" "}
              {text.before} «<span className="font-semibold text-foreground">{item.bookTitle}</span>» {text.after}
            </p>
            <time dateTime={item.createdAt} className="mt-1 block text-[10px] text-muted-foreground/75 sm:text-[11px]">
              {new Date(item.createdAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}
            </time>
          </Link>
        </div>
      </div>

      <ActivityActions likeCount={item.likeCount} likedByViewer={item.likedByViewer} commentCount={item.commentCount} commentTarget={item.commentTarget} canLike={canLike} className="col-start-2 mt-0 justify-end sm:col-start-3 sm:row-start-1" />
    </li>
  );
}
