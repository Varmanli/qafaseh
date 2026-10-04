import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import { ActivityCard } from "@/components/feed/FeedTimeline";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicProfile } from "@/lib/profile/service";
import { isReservedUsername, normalizeUsername } from "@/lib/profile/username-rules";
import { getProfileActivityPage } from "@/lib/social/activity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "فعالیت‌های اخیر | قفسه" };

export default async function ProfileActivityPage({ params, searchParams }: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { username } = await params;
  if (isReservedUsername(normalizeUsername(username))) notFound();
  const viewer = await getCurrentUser();
  const result = await getPublicProfile(username, viewer?.id);
  if (!result.found || result.isPrivate) notFound();
  const { cursor } = await searchParams;
  if (Array.isArray(cursor)) notFound();
  const page = await getProfileActivityPage(result.profile.userId, viewer?.id, cursor ?? null).catch((error: unknown) => {
    if (error instanceof Error && error.message === "INVALID_CURSOR") notFound();
    throw error;
  });
  const profileHref = `/${encodeURIComponent(result.profile.username || username)}`;
  const activityHref = `${profileHref}/activity`;

  return (
    <PublicShell user={viewer}>
      <main dir="rtl" className="mx-auto min-h-[70dvh] w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-9">
        <header className="relative mb-6 flex min-h-11 items-center justify-center border-b border-border/50 pb-4 sm:mb-8">
          <Link href={profileHref} aria-label="بازگشت به پروفایل" className="absolute start-0 top-0 flex h-8 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
            <ArrowRight className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">بازگشت به پروفایل</span>
          </Link>
          <h1 className="text-lg font-black text-foreground sm:text-xl">فعالیت‌های اخیر</h1>
        </header>

        {page.items.length ? (
          <ol className="space-y-4 sm:space-y-5">{page.items.map((item) => <ActivityCard key={item.id} item={item} canComment={!!viewer} />)}</ol>
        ) : <p className="py-16 text-center text-sm text-muted-foreground">هنوز فعالیتی ثبت نشده است.</p>}

        {cursor || page.nextCursor ? (
          <nav aria-label="صفحه‌بندی فعالیت‌ها" className="mt-6 flex items-center justify-center gap-4 text-sm font-bold">
            {cursor ? <Link href={activityHref} className="rounded-full px-4 py-2 text-muted-foreground hover:text-foreground">جدیدترین فعالیت‌ها</Link> : null}
            {page.nextCursor ? <Link href={`${activityHref}?cursor=${encodeURIComponent(page.nextCursor)}`} className="rounded-full border border-border/60 px-5 py-2 text-primary transition-colors hover:bg-primary/5">فعالیت‌های قدیمی‌تر</Link> : null}
          </nav>
        ) : null}
      </main>
    </PublicShell>
  );
}
