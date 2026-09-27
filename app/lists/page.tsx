import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Bookmark, Eye, Sparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import BookCoverImage from "@/components/books/BookCoverImage";
import ReadingListCard from "@/components/lists/ReadingListCard";
import { getReadingListsOverview } from "@/lib/book/reading-lists-service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "مسیرهای مطالعه کتاب",
    description:
      "مسیرهای مطالعه و مجموعه‌های کتاب برگزیده برای شروع از ادبیات جهان، داستان‌های خیال‌انگیز و موضوع‌های نزدیک به زندگی.",
    path: "/lists",
  });
}

export default async function ReadingListsHub() {
  const lists = await getReadingListsOverview();
  const groups = [...new Set(lists.map((list) => list.hubGroup))];
  const heroBooks =
    lists
      .find((list) => list.previewBooks.length > 0)
      ?.previewBooks.slice(0, 3) ?? [];

  return (
    <PublicShell>
      <main
        dir="rtl"
        className="mx-auto w-full max-w-7xl space-y-9 px-4 py-6 sm:space-y-12 sm:px-6 sm:py-9"
      >
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep text-white shadow-[0_28px_70px_-32px_rgba(15,35,28,0.65)] sm:rounded-[2rem]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 left-1/4 -z-10 size-72 rounded-full bg-[#b5d5c6]/[0.1] blur-[90px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 -z-10 size-72 rounded-full bg-white/[0.07] blur-[80px]"
          />
          <div className="grid items-center gap-1 px-5 pb-5 pt-7 sm:gap-4 sm:px-9 sm:pb-9 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] lg:px-12 lg:py-12">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-white/70 sm:text-sm">
                <Bookmark
                  aria-hidden="true"
                  className="size-4 text-[#c4decf]"
                />{" "}
                فهرست‌های مطالعهٔ قفسه
              </span>
              <h1 className="mt-4 text-[2rem] font-black leading-[1.35] tracking-tight sm:mt-5 sm:text-4xl lg:text-[3.25rem]">
                مسیرها و <span className="text-[#c4decf]">مجموعه‌ها</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/70 sm:mt-4 sm:text-base sm:leading-8">
                برای شروع یا ادامهٔ مطالعه، فهرستی متناسب با سلیقه‌ات پیدا کن.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] font-bold sm:mt-6 sm:flex sm:flex-wrap sm:gap-2.5 sm:text-xs">
                <span className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.08] px-2 text-white/90 sm:gap-2 sm:px-3.5">
                  <BookOpen
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[#c4decf]"
                  />
                  <span className="truncate">
                    {lists.length.toLocaleString("fa-IR")} فهرست آماده
                  </span>
                </span>
                <span className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/[0.08] px-2 text-white/75 sm:gap-2 sm:px-3.5">
                  <Sparkles aria-hidden="true" className="size-4 shrink-0" />
                  <span className="sm:hidden">مسیر و مجموعه</span>
                  <span className="hidden sm:inline">
                    برای هر سلیقه، یک شروع تازه
                  </span>
                </span>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="relative mx-auto grid h-44 w-full max-w-xs shrink-0 place-items-center sm:h-48 lg:h-60"
            >
              <span className="absolute inset-x-5 inset-y-0 hidden rounded-full border border-white/[0.07] sm:block" />
              {heroBooks.length > 0 ? (
                <div className="relative flex items-center justify-center -space-x-9 [direction:rtl] sm:-space-x-11">
                  {heroBooks.map((book, index) => (
                    <span
                      key={book.id}
                      className={`relative block aspect-[2/3] w-[4.4rem] overflow-hidden rounded-lg border-2 border-primary-deep bg-white/10 shadow-[0_22px_40px_-16px_rgba(0,0,0,0.55)] transition-transform sm:w-[5.3rem] ${index === 1 ? "-translate-y-3" : "translate-y-1"}`}
                      style={{ zIndex: heroBooks.length - index }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white/50">
                        قفسه
                      </span>
                      <BookCoverImage
                        src={book.coverImage}
                        alt=""
                        fill
                        sizes="84px"
                        className="object-cover"
                      />
                    </span>
                  ))}
                </div>
              ) : (
                <span className="relative grid size-20 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
                  <BookOpen className="size-9" />
                </span>
              )}
              <span className="absolute bottom-0 rounded-full border border-white/15 bg-primary-deep/90 px-3 py-1.5 text-[10px] font-bold text-white/80 shadow-lg backdrop-blur">
                داستان بعدی‌ات اینجاست
              </span>
            </div>
          </div>
        </header>

        {groups.length ? (
          groups.map((group, groupIndex) => {
            const groupLists = lists.filter((list) => list.hubGroup === group);
            return (
              <section key={group} aria-labelledby={`list-group-${groupIndex}`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/10 bg-primary/[0.07] text-xs font-black text-primary"
                    >
                      {(groupIndex + 1).toLocaleString("fa-IR", {
                        minimumIntegerDigits: 2,
                      })}
                    </span>
                    <div className="min-w-0">
                      <h2
                        id={`list-group-${groupIndex}`}
                        className="mt-0.5 truncate text-lg font-black sm:text-xl"
                      >
                        {group}
                      </h2>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/lists/all?group=${encodeURIComponent(group)}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-primary/15 bg-primary/[0.06] px-3 text-xs font-bold text-primary outline-none transition-colors hover:border-primary/25 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      همهٔ فهرست‌ها{" "}
                      <Eye aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                  {groupLists.slice(0, 2).map((list) => (
                    <ReadingListCard key={list.slug} list={list} />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <p className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
            فعلاً لیستی در دسترس نیست.
          </p>
        )}

        <aside className="relative isolate flex flex-col items-start justify-between gap-5 overflow-hidden rounded-[1.5rem] border border-primary/10 bg-gradient-to-l from-primary/[0.09] via-card to-card p-5 sm:flex-row sm:items-center sm:p-7">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-10 -top-16 -z-10 size-44 rounded-full bg-primary/[0.07] blur-3xl"
          />
          <div className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/[0.1] text-primary">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-black sm:text-lg">
                هنوز نمی‌دونی چی بخونی؟
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                با حال‌وهوا و سلیقه‌ات کتاب بعدی را پیدا کن.
              </p>
            </div>
          </div>
          <Link
            href="/discover"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
          >
            کشف کتاب <ArrowLeft aria-hidden="true" className="size-4" />
          </Link>
        </aside>
      </main>
    </PublicShell>
  );
}
