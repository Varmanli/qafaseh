import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Globe, Instagram, Linkedin, Lock, Send, Twitter } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getPublicProfile } from "@/lib/profile/service";
import { getPublicQuotesByUsername } from "@/lib/quotes/service";
import { getPublishedNotesByUsername } from "@/lib/notes/service";
import {
  isReservedUsername,
  normalizeUsername,
} from "@/lib/profile/username-rules";
import { toAbsoluteUrl } from "@/lib/seo/site";

import PublicShell from "@/components/PublicShell";
import LibraryShowcase from "@/components/profile/LibraryShowcase";
import QuotesSection from "@/components/profile/QuotesSection";
import NotesSection from "@/components/profile/NotesSection";
import ProfileHeader, {
  type ProfileSocialLink,
} from "@/components/profile/ProfileHeader";

export const dynamic = "force-dynamic";

type RootProfilePageProps = {
  params: Promise<{ username: string }>;
};

type SocialProfile = {
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  telegram: string | null;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <PublicShell>
      <main className="relative mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top,rgba(128,167,150,0.1),transparent_52%)]" />

        {children}
      </main>
    </PublicShell>
  );
}

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function normalizeSocialHandle(value: string) {
  return value.trim().replace(/^@/, "");
}

function socialLinks(profile: SocialProfile): ProfileSocialLink[] {
  const links: ProfileSocialLink[] = [];

  if (profile.website) {
    const href = normalizeExternalUrl(profile.website);

    if (href) {
      links.push({
        href,
        label: "وب‌سایت",
        icon: Globe,
      });
    }
  }

  if (profile.instagram) {
    const handle = normalizeSocialHandle(profile.instagram);

    if (handle) {
      links.push({
        href: `https://instagram.com/${handle}`,
        label: "اینستاگرام",
        icon: Instagram,
      });
    }
  }

  if (profile.twitter) {
    const handle = normalizeSocialHandle(profile.twitter);

    if (handle) {
      links.push({
        href: `https://x.com/${handle}`,
        label: "ایکس",
        icon: Twitter,
      });
    }
  }

  if (profile.telegram) {
    const handle = normalizeSocialHandle(profile.telegram);

    if (handle) {
      links.push({
        href: `https://t.me/${handle}`,
        label: "تلگرام",
        icon: Send,
      });
    }
  }

  if (profile.linkedin) {
    const href = normalizeExternalUrl(profile.linkedin);

    if (href) {
      links.push({
        href,
        label: "لینکدین",
        icon: Linkedin,
      });
    }
  }

  return links;
}

export default async function RootProfilePage({
  params,
}: RootProfilePageProps) {
  const { username } = await params;
  const normalizedUsername = normalizeUsername(username);

  if (isReservedUsername(normalizedUsername)) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const result = await getPublicProfile(username, viewer?.id);

  if (!result.found) {
    notFound();
  }

  if (result.isPrivate) {
    return (
      <Shell>
        <PrivateProfileState
          name={result.displayName}
          username={result.username || username}
          image={result.image}
        />
      </Shell>
    );
  }

  const { profile, stats, books, isOwner } = result;
  const profileUsername = profile.username || username;

  const joined = new Date(profile.joinedAt).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
  });

  const [quotesResult, notesResult] = await Promise.all([
    getPublicQuotesByUsername(username, viewer?.id, { limit: 5 }),
    getPublishedNotesByUsername(username, viewer?.id, { limit: 5 }),
  ]);

  const quotes =
    quotesResult.found && !quotesResult.isPrivate ? quotesResult.quotes : [];

  const notes =
    notesResult.found && !notesResult.isPrivate ? notesResult.notes : [];

  const quotesHasMore =
    quotesResult.found && !quotesResult.isPrivate
      ? quotesResult.hasMore
      : false;

  const notesHasMore =
    notesResult.found && !notesResult.isPrivate ? notesResult.hasMore : false;

  return (
    <Shell>
      <div className="space-y-4 sm:space-y-5">
        <ProfileHeader
          name={profile.displayName}
          username={profileUsername}
          image={profile.image}
          bannerImage={profile.bannerImage}
          bio={profile.bio}
          location={profile.location}
          joined={joined}
          visibility={profile.profileVisibility}
          isOwner={isOwner}
          finished={stats.finished}
          reading={stats.reading}
          wantToRead={stats.wantToRead}
          averageRating={stats.averageRating}
          profileUrl={toAbsoluteUrl(`/${encodeURIComponent(profileUsername)}`)}
          socialLinks={socialLinks(profile)}
        />

        {/* Unified profile content */}
        <div className="overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/55 shadow-sm sm:rounded-[2rem]">
          <div className="px-3 py-4 sm:px-5 sm:py-6">
            <LibraryShowcase
              books={books}
              username={profileUsername}
              stats={stats}
            />
          </div>

          <div className="mx-3 border-t border-border/60 sm:mx-5" />

          <div className="px-3 py-4 sm:px-5 sm:py-6">
            <QuotesSection
              quotes={quotes}
              initialHasMore={quotesHasMore}
              username={profileUsername}
              isOwner={isOwner}
              canLike={!!viewer}
            />
          </div>

          <div className="mx-3 border-t border-border/60 sm:mx-5" />

          <div className="px-3 py-4 sm:px-5 sm:py-6">
            <NotesSection
              notes={notes}
              initialHasMore={notesHasMore}
              username={profileUsername}
              isOwner={isOwner}
              canLike={!!viewer}
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function PrivateProfileState({
  name,
  username,
  image,
}: {
  name: string | null;
  username: string | null;
  image: string | null;
}) {
  const displayName = name || username || "کاربر قفسه";

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/60 shadow-sm sm:rounded-[2rem]">
      <div className="flex flex-col items-center px-5 py-9 text-center sm:px-8 sm:py-11">
        <div className="relative">
          <AvatarCircle src={image} name={displayName} />

          <span className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-card bg-background text-muted-foreground sm:h-8 sm:w-8">
            <Lock className="h-3.5 w-3.5" />
          </span>
        </div>

        <h1 className="mt-4 text-lg font-black text-foreground sm:text-xl">
          {displayName}
        </h1>

        {username ? (
          <p
            dir="ltr"
            className="mt-1 text-xs text-muted-foreground sm:text-sm"
          >
            @{username}
          </p>
        ) : null}

        <div className="mt-6 h-px w-full max-w-md bg-border/60" />

        <div className="mt-6 max-w-md">
          <h2 className="text-sm font-bold text-foreground">
            این پروفایل خصوصی است
          </h2>

          <p className="mt-2 text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
            کتابخانه، یادداشت‌ها و تکه‌های این کاربر برای دیگران قابل مشاهده
            نیست.
          </p>
        </div>
      </div>
    </section>
  );
}

function AvatarCircle({
  src,
  name,
}: {
  src: string | null;
  name: string | null;
}) {
  const initial = (name || "ق").trim().charAt(0) || "ق";

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-secondary text-2xl shadow-sm sm:h-24 sm:w-24 sm:text-3xl">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name || "آواتار"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-black text-muted-foreground">{initial}</span>
      )}
    </div>
  );
}
