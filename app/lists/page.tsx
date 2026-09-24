import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Eye, Sparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import BookCoverImage from "@/components/books/BookCoverImage";
import ReadingListCard from "@/components/lists/ReadingListCard";
import { getReadingListsOverview } from "@/lib/book/reading-lists-service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "مسیرهای مطالعه کتاب",
    description: "مسیرهای مطالعه و مجموعه‌های کتاب برگزیده برای شروع از ادبیات جهان، داستان‌های خیال‌انگیز و موضوع‌های نزدیک به زندگی.",
    path: "/lists",
  });
}

export default async function ReadingListsHub() {
  const lists = await getReadingListsOverview();
  const groups = [...new Set(lists.map((list) => list.hubGroup))];
  const heroBooks = lists.find((list) => list.previewBooks.length > 0)?.previewBooks.slice(0, 3) ?? [];

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-7 px-4 py-6 sm:space-y-9 sm:px-6 sm:py-9">
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep p-5 text-white shadow-[0_24px_70px_-38px_rgba(43,98,82,0.6)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 -z-10 size-64 rounded-full border border-white/10 sm:size-80" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-2 -top-12 -z-10 size-40 rounded-full border border-white/10 sm:size-52" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/3 -z-10 size-64 rounded-full bg-white/[0.06] blur-3xl" />
          <Link href="/discover" className="inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-bold text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white"><ArrowRight aria-hidden="true" className="size-4" /> بازگشت به کشف کتاب</Link>
          <div className="mt-4 grid items-center gap-4 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.72fr)] sm:gap-6 lg:gap-10">
            <div className="min-w-0">
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 text-xs font-bold text-white/85"><Bookmark aria-hidden="true" className="size-4" /> فهرست‌های قفسه</span>
              <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">مسیرها و مجموعه‌ها</h1>
              <p className="mt-2 max-w-xl text-sm leading-7 text-white/70 sm:text-base">برای شروع یا ادامهٔ مطالعه، یک فهرست انتخاب کن.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-white/75">
                <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3"><BookOpen className="size-4" /> {lists.length.toLocaleString("fa-IR")} فهرست آماده</span>
                <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3"><Sparkles className="size-4" /> مسیرهای منتخب</span>
              </div>
            </div>
            <div aria-hidden="true" className="relative mx-auto grid h-40 w-52 shrink-0 place-items-center sm:h-48 sm:w-60 lg:h-52 lg:w-64">
              <span className="absolute inset-0 rounded-full border border-white/15" />
              <span className="absolute inset-4 rounded-full border border-dashed border-white/20" />
              {heroBooks.length > 0 ? <div className="relative flex items-center justify-center -space-x-9 [direction:rtl] sm:-space-x-11">
                {heroBooks.map((book, index) => <span key={book.id} className={`relative block aspect-[2/3] w-[4.4rem] overflow-hidden rounded-lg border-2 border-primary-deep bg-white/10 shadow-2xl transition-transform sm:w-[5.3rem] ${index === 1 ? "-translate-y-3" : "translate-y-1"}`} style={{ zIndex: heroBooks.length - index }}>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white/50">قفسه</span>
                  <BookCoverImage src={book.coverImage} alt="" fill sizes="84px" className="object-cover" />
                </span>)}
              </div> : <span className="relative grid size-20 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur"><BookOpen className="size-9" /></span>}
              <span className="absolute bottom-0 rounded-full border border-white/15 bg-primary-deep px-3 py-1 text-[10px] font-bold">برای انتخاب بعدی‌ات</span>
            </div>
          </div>
        </header>

        {groups.length ? groups.map((group, groupIndex) => {
          const groupLists = lists.filter((list) => list.hubGroup === group);
          return (
            <section key={group} aria-labelledby={`list-group-${groupIndex}`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4 sm:mb-5 sm:pb-5">
                <div>
                  <p className="text-xs font-bold text-primary">دستهٔ {(groupIndex + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</p>
                  <h2 id={`list-group-${groupIndex}`} className="mt-1 text-xl font-black sm:text-2xl">{group}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex min-h-8 items-center rounded-full border border-border/60 bg-card px-3 text-xs font-bold text-muted-foreground">{groupLists.length.toLocaleString("fa-IR")} لیست</span>
                  <Link href={`/lists/all?group=${encodeURIComponent(group)}`} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 text-xs font-bold text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary">مشاهدهٔ همه <Eye aria-hidden="true" className="size-3.5" /></Link>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                {groupLists.slice(0, 2).map((list) => <ReadingListCard key={list.slug} list={list} />)}
              </div>
            </section>
          );
        }) : <p className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">فعلاً لیستی در دسترس نیست.</p>}

        <aside className="relative isolate flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card p-5 sm:p-6">
          <span aria-hidden="true" className="pointer-events-none absolute -left-8 -top-14 -z-10 size-36 rounded-full bg-primary/[0.06] blur-2xl" />
          <div><h2 className="text-base font-black">هنوز نمی‌دونی چی بخونی؟</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">با حال‌وهوا و سلیقه‌ات کتاب بعدی را پیدا کن.</p></div>
          <Link href="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">کشف کتاب <ArrowLeft aria-hidden="true" className="size-4" /></Link>
        </aside>
      </main>
    </PublicShell>
  );
}
