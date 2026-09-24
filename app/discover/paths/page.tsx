import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Dice5, ListOrdered, Sparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import BookCoverImage from "@/components/books/BookCoverImage";
import RandomPick from "@/components/discover/RandomPick";
import { getPublicBookHref } from "@/lib/book/public-href";
import { getRandomDiscoveryBook } from "@/lib/book/discover-service";
import { getDiscoverReadingPaths } from "@/lib/book/reading-lists-service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "از کجا شروع کنم؟ | کشف کتاب",
    description: "یک مسیر مطالعه انتخاب کن و کتاب‌ها را قدم‌به‌قدم بخوان.",
    path: "/discover/paths",
  });
}

export default async function DiscoverPathsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const wantsRandom = first(params.pick) === "random";
  const [randomBook, readingPaths] = await Promise.all([
    wantsRandom ? getRandomDiscoveryBook() : Promise.resolve(null),
    getDiscoverReadingPaths(),
  ]);
  const randomHref = randomBook && getPublicBookHref(randomBook);

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-7 px-4 py-6 sm:space-y-9 sm:px-6 sm:py-9">
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep p-5 text-white shadow-[0_24px_70px_-38px_rgba(43,98,82,0.6)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 -z-10 size-64 rounded-full border border-white/10 sm:size-80" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-2 -top-12 -z-10 size-40 rounded-full border border-white/10 sm:size-52" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/3 -z-10 size-64 rounded-full bg-white/[0.06] blur-3xl" />
          <Link href="/discover" className="inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-bold text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white"><ArrowRight aria-hidden="true" className="size-4" /> بازگشت به روش‌های کشف</Link>
          <div className="mt-6 grid items-center gap-7 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
            <div>
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 text-xs font-bold text-white/85"><ListOrdered aria-hidden="true" className="size-4" /> پیشنهاد مسیر مطالعه</span>
              <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">از کجا شروع کنم؟</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/70 sm:text-base">یک مسیر را انتخاب کن؛ در صفحهٔ بعد کتاب‌ها را به ترتیب پیشنهادی و قدم‌به‌قدم می‌بینی.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-bold text-white/80"><span className="grid size-5 place-items-center rounded-full bg-white/15 text-[10px]">۱</span> مرحلهٔ اول · انتخاب مسیر</div>
            </div>
            <div aria-hidden="true" className="relative mx-auto grid size-36 shrink-0 place-items-center sm:size-44">
              <span className="absolute inset-0 rounded-full border border-white/15" />
              <span className="absolute inset-4 rounded-full border border-dashed border-white/20" />
              <span className="grid size-20 place-items-center rounded-[1.7rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur sm:size-24"><BookOpen className="size-10 text-white sm:size-12" /></span>
              <span className="absolute right-2 top-4 grid size-9 place-items-center rounded-xl border border-white/15 bg-white/10"><Sparkles className="size-4" /></span>
              <span className="absolute bottom-2 left-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold">به ترتیب بخوان</span>
            </div>
          </div>
        </header>

        <section className="relative isolate overflow-hidden rounded-[1.5rem] bg-primary-deep p-5 text-white shadow-[0_18px_50px_-34px_rgba(43,98,82,0.6)] sm:p-6 lg:p-7" aria-label="انتخاب تصادفی کتاب">
            <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-12 -z-10 size-40 rounded-full border border-white/10" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div className="min-w-0">
                <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 text-xs font-bold text-white/75"><Dice5 aria-hidden="true" className="size-4" /> انتخاب خودکار</span>
                <h2 className="mt-3 text-lg font-black">انتخاب را بسپار به قفسه</h2>
                <p className="mt-1 text-sm leading-6 text-white/70">اگر هنوز مرددی، یک کتاب تازه برات پیدا می‌کنیم.</p>
              </div>
              <div className="min-w-0 sm:w-[min(100%,24rem)]">
                <RandomPick basePath="/discover/paths" hasPick={wantsRandom}>
                  {wantsRandom && (randomBook && randomHref ? (
                    <div className="mt-5 flex items-center gap-4 border-t border-white/20 pt-5">
                      <Link href={randomHref} aria-label={`صفحه کتاب ${randomBook.title}`} className="relative h-28 w-[4.7rem] shrink-0 overflow-hidden rounded-lg bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-xs font-black text-white/50">قفسه</span>
                        <BookCoverImage src={randomBook.coverImage} alt="" fill sizes="75px" className="object-cover" />
                      </Link>
                      <div className="min-w-0"><p className="text-xs text-white/65">پیشنهاد قفسه</p><h3 className="mt-1 line-clamp-2 text-base font-black">{randomBook.title}</h3><p className="mt-1 text-xs text-white/70">{randomBook.author}</p><Link href={randomHref} className="mt-2 inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-white">صفحه کتاب <ArrowLeft aria-hidden="true" className="size-4" /></Link></div>
                    </div>
                  ) : <p className="mt-4 text-sm text-white/75">فعلاً کتابی برای انتخاب تصادفی در دسترس نیست. یکی از مسیرها را امتحان کن.</p>)}
                </RandomPick>
              </div>
            </div>
        </section>

        <section aria-labelledby="reading-paths-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5 sm:mb-6">
            <div>
              <p className="text-xs font-bold text-primary">مرحلهٔ دوم · انتخاب مسیر</p>
              <h2 id="reading-paths-title" className="mt-1 text-xl font-black sm:text-2xl">مسیرهای پیشنهادی</h2>
              <p className="mt-1.5 text-sm leading-7 text-muted-foreground">یکی را باز کن تا ترتیب کتاب‌ها را قدم‌به‌قدم ببینی.</p>
            </div>
            <span className="inline-flex min-h-9 items-center rounded-full border border-border/60 bg-card px-3 text-xs font-bold text-muted-foreground">{readingPaths.length.toLocaleString("fa-IR")} مسیر</span>
          </div>
          {readingPaths.length ? <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            {readingPaths.map((path) => {
              const preview = path.previewBooks;
              return (
                <Link key={path.slug} href={`/lists/${path.slug}`} className="group relative isolate flex min-h-52 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary sm:min-h-56">
                  <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 size-40 rounded-full bg-primary/[0.045] blur-2xl transition-transform duration-300 group-hover:scale-125" />
                  <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      <span className="rounded-full border border-primary/15 bg-primary/[0.07] px-2.5 py-1 text-primary">{path.bookCount.toLocaleString("fa-IR")} کتاب</span>
                      <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                      <span className="text-muted-foreground">به ترتیب بخوان</span>
                    </div>
                    <h3 className="mt-3 text-base font-black leading-7 tracking-tight transition-colors group-hover:text-primary sm:text-lg">{path.title}</h3>
                    {path.description && <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground sm:text-sm">{path.description}</p>}
                    <span className="mt-auto inline-flex min-h-10 items-center gap-1.5 pt-3 text-xs font-bold text-primary">دیدن مسیر <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1" /></span>
                  </div>
                  <div className="relative flex w-28 shrink-0 items-center justify-center overflow-hidden border-r border-border/60 bg-muted/35 px-2 sm:w-36">
                    <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-primary/[0.025]" />
                    <div className="relative flex shrink-0 -space-x-7 [direction:rtl]">
                      {preview.map((book, index) => <span key={book.id} className="relative block aspect-[2/3] w-[3.6rem] overflow-hidden rounded-lg border-2 border-card bg-muted shadow-lg transition-transform duration-300 group-hover:-translate-y-1 sm:w-[4.1rem]" style={{ zIndex: preview.length - index }}><span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-muted-foreground/50">قفسه</span><BookCoverImage src={book.coverImage} alt="" fill sizes="66px" className="object-cover" /></span>)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div> : <p className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">فعلاً مسیری برای نمایش وجود ندارد.</p>}
        </section>
      </main>
    </PublicShell>
  );
}
