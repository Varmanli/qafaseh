import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Sparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import BookCoverImage from "@/components/books/BookCoverImage";
import { getPublicBookHref } from "@/lib/book/public-href";
import { getReadingListBySlug } from "@/lib/book/reading-lists-service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const list = await getReadingListBySlug(slug);
  if (!list) return { title: "مسیر مطالعه پیدا نشد | قفسه" };
  return buildPageMetadata({
    title: list.seoTitle || `${list.title} | ${list.mode === "ORDERED" ? "مسیر مطالعه" : "مجموعه کتاب"}`,
    description: list.seoDescription || list.description,
    path: `/lists/${list.slug}`,
  });
}

export default async function ReadingListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const list = await getReadingListBySlug(slug);
  if (!list) notFound();

  const difficultyLabels = { EASY: "آسان", MEDIUM: "متوسط", HARD: "چالشی" } as const;
  const previewBooks = list.items.slice(0, 3);

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-7 px-4 py-6 sm:space-y-9 sm:px-6 sm:py-9">
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep p-5 text-white shadow-[0_24px_70px_-38px_rgba(43,98,82,0.6)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 -z-10 size-64 rounded-full border border-white/10 sm:size-80" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-2 -top-12 -z-10 size-40 rounded-full border border-white/10 sm:size-52" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/3 -z-10 size-64 rounded-full bg-white/[0.06] blur-3xl" />
          <Link href="/lists" className="-mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-bold text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:-mt-3">
            <ArrowRight aria-hidden="true" className="size-4" /> بازگشت به لیست‌ها
          </Link>
          <div className="grid items-center gap-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
            <div className="min-w-0">
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 text-xs font-bold text-white/85"><Bookmark aria-hidden="true" className="size-4" /> {list.mode === "ORDERED" ? "مسیر ترتیبی" : "مجموعه کتاب"} · {list.category}</span>
              <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">{list.title}</h1>
              <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">{list.description}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-white/80">
                <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3"><BookOpen aria-hidden="true" className="size-4" /> {list.items.length.toLocaleString("fa-IR")} کتاب · {list.mode === "ORDERED" ? "مسیر ترتیبی" : "مجموعه پیشنهادی"}</span>
              </div>
            </div>
            <div aria-hidden="true" className="relative mx-auto grid size-40 shrink-0 place-items-center sm:size-52">
              <span className="absolute inset-0 rounded-full border border-white/15" />
              <span className="absolute inset-3 rounded-full border border-dashed border-white/20" />
              {previewBooks.length ? <div className="relative flex items-center justify-center -space-x-7 [direction:rtl] sm:-space-x-9">
                {previewBooks.map(({ book }, index) => <span key={book.id} className={`relative block aspect-[2/3] w-[4rem] overflow-hidden rounded-lg border-2 border-primary-deep bg-white/10 shadow-xl transition-transform sm:w-[5rem] ${index === 1 ? "-translate-y-3" : "translate-y-1"}`} style={{ zIndex: previewBooks.length - index }}>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white/50">قفسه</span>
                  <BookCoverImage src={book.coverImage} alt="" fill sizes="80px" className="object-cover" />
                </span>)}
              </div> : <BookOpen className="size-12 text-white/70" />}
              {list.mode === "ORDERED" && <span className="absolute -bottom-1 rounded-full border border-white/15 bg-primary-deep px-3 py-1 text-[10px] font-bold text-white/85">کتاب اول، شروع ماجرا</span>}
            </div>
          </div>
        </header>

        {list.audience && <aside className="relative isolate flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-3 sm:gap-4 sm:px-5">
          <span aria-hidden="true" className="pointer-events-none absolute -left-8 -top-12 -z-10 size-32 rounded-full bg-primary/[0.06] blur-2xl" />
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.09] text-primary"><Sparkles className="size-4" /></span>
          <p className="min-w-0 text-xs leading-6 text-muted-foreground sm:text-sm"><span className="ml-1 font-black text-foreground">مناسب برای:</span>{list.audience}</p>
        </aside>}

        {list.mode === "ORDERED" ? <section aria-labelledby="sequence-title">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 sm:mb-6 sm:pb-5">
            <h2 id="sequence-title" className="text-xl font-black sm:text-2xl">ترتیب کتاب‌ها</h2>
            <span className="inline-flex min-h-8 items-center rounded-full border border-border/60 bg-card px-3 text-xs font-bold text-muted-foreground">{list.items.length.toLocaleString("fa-IR")} مرحله</span>
          </div>

          <ol className="grid gap-4 lg:gap-5">
            {list.items.map(({ book, note, difficulty }, index) => {
              const bookHref = getPublicBookHref(book);
              return (
                <li key={book.id}>
                  <Link href={bookHref!} aria-label={`صفحه کتاب ${book.title}`} className="group relative isolate flex min-h-48 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary sm:min-h-52">
                    <span aria-hidden="true" className="pointer-events-none absolute -left-10 -top-12 -z-10 size-40 rounded-full bg-primary/[0.05] blur-2xl transition-transform duration-300 group-hover:scale-125" />
                    <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-6">
                      <span className="inline-flex w-fit min-h-7 items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.07] px-2.5 text-[11px] font-bold text-primary"><span>{(index + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</span><span className="text-primary/40" aria-hidden="true">·</span> گام از {list.items.length.toLocaleString("fa-IR")}</span>
                      <h3 className="mt-3 text-base font-black leading-7 transition-colors group-hover:text-primary sm:text-xl">{book.title}</h3>
                      <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">{book.author}</p>
                      {difficulty && <span className="mt-3 w-fit rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">برای شروع: {difficultyLabels[difficulty]}</span>}
                      {note && <p className="mt-3 text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">{note}</p>}
                      <span className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-bold text-primary">رفتن به صفحهٔ کتاب <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1" /></span>
                    </div>
                    <div aria-hidden="true" className="relative flex w-[34%] min-w-[6rem] shrink-0 items-center justify-center overflow-hidden border-r border-border/50 bg-gradient-to-br from-primary/[0.09] via-primary/[0.035] to-transparent sm:w-[26%] sm:min-w-[11rem]">
                      <span className="pointer-events-none absolute -left-10 -top-10 size-32 rounded-full border border-primary/[0.08]" />
                      <span className="pointer-events-none absolute -bottom-12 -right-8 size-32 rounded-full bg-primary/[0.07] blur-2xl" />
                      <span className="relative block aspect-[2/3] w-[4.6rem] overflow-hidden rounded-lg border-2 border-card bg-muted shadow-[0_14px_28px_-12px_rgba(0,0,0,0.65)] transition-transform duration-300 group-hover:-translate-y-1 sm:w-[6.5rem]">
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-muted-foreground/50">قفسه</span>
                        <BookCoverImage src={book.coverImage} alt="" fill sizes="(max-width: 640px) 74px, 104px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section> : <section aria-labelledby="collection-title">
          <div className="mb-5 border-b border-border/60 pb-4"><h2 id="collection-title" className="text-xl font-black sm:text-2xl">کتاب‌های این مجموعه</h2></div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map(({ book, note }) => <li key={book.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <Link href={getPublicBookHref(book)!} className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="relative block aspect-[2/3] w-28 overflow-hidden rounded-lg bg-muted sm:w-32"><BookCoverImage src={book.coverImage} alt="" fill sizes="128px" className="object-cover" /></span>
                <h3 className="mt-3 text-base font-black group-hover:text-primary">{book.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
              </Link>
              {note && <p className="mt-3 text-sm leading-7 text-muted-foreground">{note}</p>}
            </li>)}
          </ul>
        </section>}

        {list.relatedLists.length > 0 && <section aria-labelledby="related-lists-title" className="relative isolate overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-4 sm:rounded-[2rem] sm:p-6 lg:p-7">
          <span aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 -z-10 size-48 rounded-full bg-primary/[0.05] blur-2xl" />
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4 sm:pb-5">
            <div>
              <p className="text-xs font-bold text-primary">برای ادامهٔ این حال‌وهوا</p>
              <h2 id="related-lists-title" className="mt-1 text-xl font-black sm:text-2xl">شاید این لیست‌ها هم به دلت بشینن</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">چند انتخاب دیگه با موضوع و فضای نزدیک.</p>
            </div>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 text-xs font-bold text-muted-foreground"><Bookmark className="size-3.5 text-primary" /> پیشنهاد قفسه</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.relatedLists.map((related, index) => <Link key={related.slug} href={`/lists/${related.slug}`} className="group relative flex min-h-24 items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-background/55 p-4 outline-none transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary sm:p-5">
              {list.mode === "ORDERED" && <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary/[0.07] text-xs font-black text-primary">{(index + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</span>}
              <span className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-bold text-primary">{related.category}</span><span className="block text-sm font-black leading-6 transition-colors group-hover:text-primary">{related.title}</span><span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground transition-colors group-hover:text-primary">دیدن لیست {list.mode === "ORDERED" && <ArrowLeft aria-hidden="true" className="size-3.5 transition-transform group-hover:-translate-x-1" />}</span></span>
              {list.mode === "ORDERED" && <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full text-primary/70 transition-colors group-hover:bg-primary/[0.08] group-hover:text-primary"><ArrowLeft className="size-4" /></span>}
            </Link>)}
          </div>
        </section>}
      </main>
    </PublicShell>
  );
}
