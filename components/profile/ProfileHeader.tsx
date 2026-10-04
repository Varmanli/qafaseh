import Link from "next/link";
import { CalendarDays, Lock, MapPin, Settings } from "lucide-react";
import type { ElementType } from "react";

import ReaderRankBadge from "@/components/profile/ReaderRankBadge";
import ProfileBio from "@/components/profile/ProfileBio";
import ProfileShare from "@/components/profile/ProfileShare";
import FollowButton from "@/components/profile/FollowButton";
import { Button } from "@/components/ui/button";

export interface ProfileSocialLink {
  href: string;
  label: string;
  icon: ElementType;
}

export default function ProfileHeader({
  name,
  username,
  image,
  bannerImage,
  bio,
  location,
  joined,
  visibility,
  isOwner,
  finished,
  reading,
  wantToRead,
  averageRating,
  profileUrl,
  socialLinks,
  followerCount,
  followingCount,
  isFollowing,
}: {
  name: string | null;
  username: string;
  image: string | null;
  bannerImage: string | null;
  bio: string | null;
  location: string | null;
  joined: string;
  visibility: "PUBLIC" | "PRIVATE";
  isOwner: boolean;
  finished: number;
  reading: number;
  wantToRead: number;
  averageRating: number | null;
  profileUrl: string;
  socialLinks: ProfileSocialLink[];
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}) {
  const displayName = name || username;

  return (
    <section className="overflow-hidden rounded-2xl rounded-b-none border border-border/60 border-b-0 bg-card/55 shadow-sm sm:rounded-3xl sm:rounded-b-none lg:rounded-b-3xl lg:border-b">
      {/* Banner */}
      <div className="relative h-28 overflow-hidden sm:h-32 lg:h-36">
        {bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerImage}
            alt={`بنر پروفایل ${displayName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,rgba(128,167,150,0.2),transparent_42%),radial-gradient(circle_at_top_left,rgba(43,98,82,0.16),transparent_38%),linear-gradient(135deg,var(--surface-2),var(--card))]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-black/10 dark:from-black/60 dark:via-black/15 dark:to-black/25" />

        <div className="absolute right-3 top-3 origin-top-right scale-90 sm:right-4 sm:top-4 sm:scale-100">
          <ReaderRankBadge finished={finished} />
        </div>

        {isOwner && visibility === "PRIVATE" ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-500/12 px-2 py-1 text-[10px] font-bold text-amber-100 backdrop-blur-sm sm:left-4 sm:top-4 sm:gap-1.5 sm:px-2.5 sm:text-xs dark:text-amber-200">
            <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            خصوصی
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="px-3 pb-4 sm:px-5 sm:pb-5">
        {/* Identity Block */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 items-start gap-3 text-right sm:items-center sm:gap-4">
            {/* Avatar overlaps the banner while the identity stays right-aligned in RTL. */}
            <div className="relative z-10 -mt-9 h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border/80 bg-secondary ring-4 ring-card sm:-mt-11 sm:h-20 sm:w-20">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-muted-foreground">
                  {displayName.trim().charAt(0)}
                </div>
              )}
            </div>

            {/* Name, Username */}
            <div className="mt-1 min-w-0 flex-1 sm:mt-0">
              <h1 className="truncate text-base font-black leading-tight text-foreground sm:text-xl">
                {displayName}
              </h1>
              <p dir="ltr" className="mt-1 truncate text-xs text-muted-foreground">
                @{username}
              </p>
            </div>
          </div>

          {/* Profile actions */}
          <div className={isOwner
            ? "flex w-full items-center gap-2 sm:w-auto sm:justify-end"
            : "mt-1 flex shrink-0 items-center gap-2 self-start sm:mt-0 sm:self-center"}>
            <div className="hidden items-center gap-2 sm:flex">
              <Link href={`/${encodeURIComponent(username)}/followers`} className="rounded-lg border border-border/40 bg-background/35 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
                <span className="font-bold text-foreground">{followerCount.toLocaleString("fa-IR")}</span> دنبال‌کننده
              </Link>
              <Link href={`/${encodeURIComponent(username)}/following`} className="rounded-lg border border-border/40 bg-background/35 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
                <span className="font-bold text-foreground">{followingCount.toLocaleString("fa-IR")}</span> دنبال‌شونده
              </Link>
            </div>
            {!isOwner ? <FollowButton username={username} initialFollowing={isFollowing} /> : null}
            {isOwner ? (
              <ProfileShare
                name={displayName}
                username={username}
                avatarUrl={image}
                readCount={finished}
                readingCount={reading}
                wantToReadCount={wantToRead}
                averageRating={averageRating}
                profileUrl={profileUrl}
              />
            ) : null}
            {isOwner ? (
              <Button asChild size="sm" variant="outline" className="h-9 flex-1 gap-1.5 rounded-lg px-3.5 text-xs font-medium sm:flex-initial">
                <Link href="/settings/profile">
                  <Settings className="h-3.5 w-3.5" />
                  تنظیمات
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {bio?.trim() ? (
          <div className="mt-2.5 w-full rounded-xl border border-border/35 bg-background/30 px-3 py-2.5 sm:mt-3 sm:max-w-xl">
            <ProfileBio bio={bio} />
          </div>
        ) : null}

        {/* Meta / Footer info */}
        <div className="mt-4 border-t border-border/40 pt-3.5">
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <Link href={`/${encodeURIComponent(username)}/followers`} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/35 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:justify-start sm:gap-2.5">
              <span className="text-xs text-muted-foreground">دنبال‌کننده</span>
              <span className="text-sm font-extrabold tabular-nums text-foreground">{followerCount.toLocaleString("fa-IR")}</span>
            </Link>
            <Link href={`/${encodeURIComponent(username)}/following`} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/35 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:justify-start sm:gap-2.5">
              <span className="text-xs text-muted-foreground">دنبال‌شونده</span>
              <span className="text-sm font-extrabold tabular-nums text-foreground">{followingCount.toLocaleString("fa-IR")}</span>
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary/80" />
                <span>عضو از {joined}</span>
              </span>

              {location ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0 text-primary/80" />
                  <span className="max-w-[12rem] truncate">{location}</span>
                </span>
              ) : null}
            </div>

            {socialLinks.length > 0 ? (
              <div className="flex items-center gap-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={link.label}
                    title={link.label}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-background/35 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    <link.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
