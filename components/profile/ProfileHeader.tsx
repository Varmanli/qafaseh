import Link from "next/link";
import { CalendarDays, Lock, MapPin, Settings } from "lucide-react";
import type { ElementType } from "react";

import ReaderRankBadge from "@/components/profile/ReaderRankBadge";
import ProfileShare from "@/components/profile/ProfileShare";
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
}) {
  const displayName = name || username;

  return (
    <section className="overflow-hidden rounded-xl border border-border/50 bg-card/40 shadow-xs">
      {/* Banner */}
      <div className="relative h-20 overflow-hidden sm:h-24 lg:h-28">
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
      <div className="px-4 pb-4 sm:px-5 sm:pb-4">
        {/* Identity Block */}
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-right sm:justify-between sm:gap-4">
          <div className="flex flex-col items-center sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            {/* Avatar with simple overlap */}
            <div className="relative z-10 -mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border/80 bg-secondary ring-4 ring-card sm:-mt-10 sm:h-20 sm:w-20">
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
            <div className="min-w-0 flex-1 mt-1 text-center sm:text-right">
              <h1 className="truncate text-base font-black text-foreground sm:text-lg">
                {displayName}
              </h1>
              <p dir="ltr" className="truncate text-[10px] text-muted-foreground mt-0.5">
                @{username}
              </p>
            </div>
          </div>

          {/* Profile actions */}
          <div className="mt-3.5 flex w-full items-center justify-center gap-2 sm:mt-0 sm:w-auto sm:justify-end">
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
            {isOwner ? (
              <Button asChild size="sm" variant="outline" className="h-8.5 rounded-lg px-3.5 text-xs font-medium gap-1.5 flex-1 sm:flex-initial">
                <Link href="/settings/profile">
                  <Settings className="h-3.5 w-3.5" />
                  تنظیمات
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Meta / Footer info */}
        <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 border-t border-border/30 pt-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            عضو از {joined}
          </span>

          {location ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="max-w-[12rem] truncate">{location}</span>
            </span>
          ) : null}

          {socialLinks.length > 0 ? (
            <div className="ms-auto flex items-center gap-2.5">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={link.label}
                  title={link.label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-black/10 text-muted-foreground transition-colors hover:border-primary/20 hover:text-primary"
                >
                  <link.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
