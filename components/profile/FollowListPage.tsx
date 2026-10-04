import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import FollowButton from "@/components/profile/FollowButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicProfile } from "@/lib/profile/service";
import { getFollowingUserIds, listFollows } from "@/lib/social/follow";

export default async function FollowListPage({ username, kind, page, query = "" }: { username: string; kind: "followers" | "following"; page: number; query?: string }) {
  const viewer = await getCurrentUser();
  const result = await getPublicProfile(username, viewer?.id);
  if (!result.found || result.isPrivate) notFound();
  const isOwner = viewer?.id === result.profile.userId;
  const { users, hasMore } = await listFollows(result.profile.userId, kind, page, isOwner, query);
  const followedIds = viewer && !isOwner ? new Set(await getFollowingUserIds(viewer.id, users.map((user) => user.userId))) : new Set<string>();
  const title = kind === "followers" ? "دنبال‌کننده‌ها" : "دنبال‌شده‌ها";
  const baseHref = `/${encodeURIComponent(username)}/${kind}`;
  const paginationHref = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage) });
    if (query) params.set("q", query);
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <PublicShell user={viewer}>
      <main className="mx-auto min-h-[70dvh] w-full max-w-2xl px-4 pb-20 pt-6 sm:px-8 sm:pt-9">
        <header className="relative flex min-h-11 items-center justify-center border-b border-border/50 pb-4">
          <h1 className="text-lg font-black text-foreground sm:text-xl">{title}</h1>
          <Link
            href={`/${encodeURIComponent(username)}`}
            aria-label="بازگشت به پروفایل"
            title="بازگشت به پروفایل"
            className="absolute start-0 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">بازگشت به پروفایل</span>
          </Link>
        </header>

        <form action={baseHref} role="search" className="mt-5">
          <label className="flex h-11 items-center gap-2.5 rounded-xl border border-border/60 bg-surface-1/50 px-3.5 transition-colors focus-within:border-primary/50">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="جست‌وجو با نام یا شناسه"
              aria-label="جست‌وجو در فهرست"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </label>
        </form>

        {users.length ? (
          <ul className="mt-6 divide-y divide-border/50 border-y border-border/50">
            {users.map((user) => (
              <li key={user.username} className="flex items-center gap-3 px-2 py-3.5">
                <Link
                  href={`/${encodeURIComponent(user.username)}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Avatar className="size-11 shrink-0 border border-border/40">
                    {user.image ? <AvatarImage src={user.image} alt={user.name || user.username} className="object-cover" /> : null}
                    <AvatarFallback className="text-sm font-bold text-muted-foreground">{(user.name || user.username).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">{user.name || user.username}</span>
                    <span dir="ltr" className="mt-0.5 block truncate text-right text-xs text-muted-foreground">@{user.username}</span>
                  </span>
                </Link>
                {!isOwner ? <FollowButton username={user.username} initialFollowing={followedIds.has(user.userId)} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 border-y border-border/50 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{query ? "نتیجه‌ای پیدا نشد." : "هنوز کسی در این فهرست نیست."}</p>
            {query ? (
              <Link href={baseHref} className="mt-3 inline-block text-sm font-bold text-primary transition-colors hover:text-primary-hover">پاک‌کردن جست‌وجو</Link>
            ) : (
              <Link href="/search?tab=users" className="mt-3 inline-block text-sm font-bold text-primary transition-colors hover:text-primary-hover">پیدا کردن کتاب‌خوان‌ها</Link>
            )}
          </div>
        )}

        {page > 1 || hasMore ? (
          <nav aria-label="صفحه‌بندی" className="mt-5 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={paginationHref(page - 1)} className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-primary">
                <ArrowRight className="size-3.5" aria-hidden="true" />
                صفحهٔ قبل
              </Link>
            ) : <span />}
            {hasMore ? (
              <Link href={paginationHref(page + 1)} className="inline-flex items-center gap-1.5 font-bold text-primary transition-colors hover:text-primary-hover">
                صفحهٔ بعد
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </PublicShell>
  );
}
