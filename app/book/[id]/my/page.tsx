import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  LockKeyhole,
  NotebookPen,
  Star,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getBookOverview, getBookMetadata } from "@/lib/book/detail-service";
import { buildPageMetadata } from "@/lib/seo/metadata";
import PublicShell from "@/components/PublicShell";
import BookCoverImage from "@/components/books/BookCoverImage";
import CurrentlyReadingCard from "@/components/books/CurrentlyReadingCard";
import PersonalBookNotesSection from "@/components/books/PersonalBookNotesSection";
import ReadingStatusControl from "@/components/books/ReadingStatusControl";
import ReadingTimeline from "@/components/books/ReadingTimeline";
import type { ViewerLibraryEntry } from "@/lib/book/detail-service";
import { getReadingHistory } from "@/lib/reading-history/service";

export const dynamic = "force-dynamic";

const PLACEHOLDER = "/placeholder-cover.svg";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const book = await getBookMetadata(decodeURIComponent(id));

  if (!book) return { title: "مطالعه من | قفسه" };

  const metadata = await buildPageMetadata({
    title: `مطالعه من: ${book.title}`,
    description: `فضای شخصی شما برای کتاب ${book.title} در قفسه.`,
    path: `/book/${encodeURIComponent(book.slug)}/my`,
    image: book.displayCoverImage,
    type: "book",
    keywords: [book.title, "مطالعه من", "مطالعه شخصی"],
  });

  return {
    ...metadata,
    robots: { index: false, follow: false },
  };
}

export default async function MyBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ref = decodeURIComponent(id);
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/book/${ref}/my`)}`);
  }

  const result = await getBookOverview(ref, user.id);
  if (!result.found) notFound();

  const { book, presentation, viewer: entry } = result;

  if (ref !== book.slug) {
    permanentRedirect(`/book/${encodeURIComponent(book.slug)}/my`);
  }

  const readingHistory = entry
    ? await getReadingHistory(user.id, entry.id)
    : {
        events: [],
        summary: { days: null, pagesRead: null, averagePagesPerDay: null },
      };

  return (
    <PublicShell user={user}>
      <div
        dir="rtl"
        className="
      mx-auto
      max-w-7xl
      px-4
      py-6
      sm:px-6
      lg:px-10
      lg:py-10
    "
      >
        {/* Back */}
        <Link
          href={`/book/${encodeURIComponent(book.slug)}`}
          className="
        mb-6
        inline-flex
        items-center
        gap-2
        text-sm
        text-muted-foreground
        hover:text-foreground
      "
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به صفحه کتاب
        </Link>

        {/* HERO */}

        <section className="group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-r from-card/80 via-card/50 to-card/80 p-3.5 backdrop-blur-xl transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-4">
          {/* Ambient Background Glow - افکت نور نرم در پس‌زمینه */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

          <div className="relative flex items-center gap-3.5 sm:gap-4">
            {/* Compact Book Cover with Subtle Hover Effect */}
            <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-md transition-transform duration-300 group-hover:scale-105 sm:w-16">
              <BookCoverImage
                src={book.displayCoverImage || PLACEHOLDER}
                alt={book.title}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              {/* Badge & Meta info */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <LockKeyhole className="h-2.5 w-2.5" />
                  فضای شخصی
                </span>
              </div>

              {/* Book Title & Author */}
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h1 className="truncate text-sm font-bold text-foreground sm:text-base">
                  {book.title}
                </h1>
                <span className="truncate text-xs font-medium text-muted-foreground/80">
                  {book.author}
                </span>
              </div>

              {/* Clean Minimal Inline Tags */}
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium hover:text-foreground transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  پیشرفت
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span className="flex items-center gap-1 font-medium hover:text-foreground transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  یادداشت‌ها
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span className="flex items-center gap-1 font-medium hover:text-foreground transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  تجربه
                </span>
              </div>
            </div>
          </div>
        </section>
        {/* MAIN GRID */}

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* LEFT COLUMN (اصلی - ۷ ستون در دسکتاپ) */}
          <div className="space-y-5 lg:col-span-7">
            {/* Reading Path Section */}
            <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-5 backdrop-blur-md transition-all hover:border-border/80 sm:p-6">
              {/* Header */}
              <SectionHeading
                icon={BookOpenCheck}
                title="مسیر مطالعه"
                description="پیشرفت فعلی و وضعیت کتاب"
              />

              {/* Progress & Status Container */}
              <div className="mt-5 space-y-4 divide-y divide-border/40">
                {entry?.status === "READING" ? (
                  <div className="pb-1">
                    <CurrentlyReadingCard
                      viewer={entry}
                      title={book.title}
                      author={book.author}
                      coverImage={book.displayCoverImage}
                    />
                  </div>
                ) : null}

                <div className="pt-4">
                  <ReadingStatusControl
                    subjectBookId={book.id}
                    bookTitle={book.title}
                    viewer={entry}
                    isLoggedIn
                    loginHref={`/auth/login?redirect=${encodeURIComponent(`/book/${book.slug}/my`)}`}
                    selectedEditionId={entry?.editionId ?? null}
                    showPersonalBookLink={false}
                  />
                </div>
              </div>
            </section>

            {/* Notes Section */}
            <PersonalBookNotesSection
              bookId={entry?.id ?? null}
              pageCount={entry?.pageCount ?? presentation.pageCount ?? null}
              isLoggedIn
            />
          </div>

          {/* RIGHT COLUMN (فرعی - ۵ ستون در دسکتاپ) */}
          <div className="space-y-5 lg:col-span-5">
            {/* Timeline Section */}
            <section className="sticky top-6 rounded-2xl border border-border/50 bg-card/50 p-5 backdrop-blur-md transition-all hover:border-border/80 sm:p-6">
              <ReadingTimeline history={readingHistory} />
            </section>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BookOpenCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-lg font-black text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function PersonalExperience({ entry }: { entry: ViewerLibraryEntry | null }) {
  const hasExperience = Boolean(
    entry &&
    (entry.rating || entry.moodTags.length || entry.privateNote?.trim()),
  );

  if (!hasExperience) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-border bg-background/35 px-4 py-8 text-center">
        <Star className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-3 text-sm font-black text-foreground">
          هنوز تجربه‌ای ثبت نکرده‌ای.
        </p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          بعد از پایان کتاب می‌توانی تجربه خودت را ثبت کنی.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-amber-300/20 bg-amber-400/[0.05] p-4">
      {entry?.rating ? (
        <div>
          <p className="text-xs font-bold text-muted-foreground">امتیاز من</p>
          <p className="mt-1 text-xl font-black tabular-nums text-foreground">
            {entry.rating.toLocaleString("fa-IR")} / ۱۰
          </p>
        </div>
      ) : null}
      {entry?.moodTags.length ? (
        <div>
          <p className="text-xs font-bold text-muted-foreground">حس من</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.moodTags.map((mood) => (
              <span
                key={mood}
                className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
              >
                {mood}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {entry?.privateNote?.trim() ? (
        <div>
          <p className="text-xs font-bold text-muted-foreground">نظر من</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
            {entry.privateNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FutureSection({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[1.7rem] border border-dashed border-border/80 bg-background/25 p-5 opacity-80">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <h2 className="mt-3 text-sm font-black text-foreground">{title}</h2>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

function formatReadingDate(value: Date | null) {
  if (!value) return "ثبت نشده";
  const today = new Date();
  const sameDay =
    today.getFullYear() === value.getFullYear() &&
    today.getMonth() === value.getMonth() &&
    today.getDate() === value.getDate();
  if (sameDay) return "امروز";
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "long",
  }).format(value);
}
