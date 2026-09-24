import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Heart, Lightbulb, Sparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import DiscoveryChoices from "@/components/discover/DiscoveryChoices";
import DiscoveryResults from "@/components/discover/DiscoveryResults";
import { moods, topics } from "@/lib/book/discover-config";
import { getDiscoveryBooks } from "@/lib/book/discover-service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "انتخاب بر اساس حال‌وهوا | کشف کتاب",
    description: "حال‌وهوا یا موضوع مورد علاقه‌ات را انتخاب کن و کتاب‌های مرتبط را ببین.",
    path: "/discover/mood",
  });
}

export default async function DiscoverMoodPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const selectedKind = first(params.mode) === "topic" || first(params.topic) ? "topic" : "mood";
  const selected = first(params[selectedKind]);
  const collections = selectedKind === "topic" ? topics : moods;
  const selectedCollection = collections.find((item) => item.slug === selected);
  const books = await getDiscoveryBooks();
  const isTopic = selectedKind === "topic";

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-9">
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep p-5 text-white shadow-[0_24px_70px_-38px_rgba(43,98,82,0.6)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 -z-10 size-64 rounded-full border border-white/10 sm:size-80" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-2 -top-12 -z-10 size-40 rounded-full border border-white/10 sm:size-52" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/3 -z-10 size-64 rounded-full bg-white/[0.06] blur-3xl" />
          <Link href="/discover" className="inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-bold text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white">
            <ArrowRight aria-hidden="true" className="size-4" /> بازگشت به روش‌های کشف
          </Link>

          <div className="mt-6 grid items-center gap-7 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
            <div>
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 text-xs font-bold text-white/85">
                {isTopic ? <Lightbulb aria-hidden="true" className="size-4" /> : <Heart aria-hidden="true" className="size-4" />}
                {selectedCollection ? "پیشنهادهای قفسه" : "کشف بر اساس سلیقه"}
              </span>
              <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">امروز چی دلت می‌خواد بخونی؟</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
                {selectedCollection
                  ? "چند پیشنهاد نزدیک به انتخابت؛ یکی رو باز کن و بیشتر بشناس."
                  : "یه حس‌وحال یا موضوع انتخاب کن؛ ما کتاب‌هایی رو پیدا می‌کنیم که بهش نزدیکن."}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-bold text-white/80">
                <span className="grid size-5 place-items-center rounded-full bg-white/15 text-[10px]">{selectedCollection ? "۲" : "۱"}</span>
                {selectedCollection ? "پیشنهادها آماده‌ست" : "مرحلهٔ اول · انتخاب حس‌وحال"}
              </div>
            </div>

            <div aria-hidden="true" className="relative mx-auto grid size-36 shrink-0 place-items-center sm:size-44">
              <span className="absolute inset-0 rounded-full border border-white/15" />
              <span className="absolute inset-4 rounded-full border border-dashed border-white/20" />
              <span className="grid size-20 place-items-center rounded-[1.7rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur sm:size-24">
                {selectedCollection ? <BookOpen className="size-10 text-white sm:size-12" /> : <Heart className="size-9 fill-white/15 text-white sm:size-11" />}
              </span>
              <span className="absolute right-2 top-4 grid size-9 place-items-center rounded-xl border border-white/15 bg-white/10"><Sparkles className="size-4" /></span>
              <span className="absolute bottom-2 left-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold">با سلیقهٔ تو</span>
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-[0_18px_50px_-36px_rgba(0,0,0,0.28)] sm:rounded-[2rem]" aria-label={isTopic ? "کشف بر اساس موضوع" : "کشف بر اساس حال‌وهوا"}>
          <div className="border-b border-border/60 p-4 sm:p-6">
            {!selectedCollection && <div><p className="text-xs font-bold text-primary">از چه راهی بگردیم؟</p><h2 className="mt-1 text-lg font-black sm:text-xl">یه گزینه انتخاب کن</h2></div>}
            <nav aria-label="روش انتخاب کتاب" className="mt-5 grid w-full grid-cols-2 rounded-2xl border border-border/60 bg-muted/60 p-1">
              <Link href="/discover/mood" scroll={false} aria-current={!isTopic ? "page" : undefined} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary sm:min-h-12 sm:px-4 sm:text-sm ${!isTopic ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Heart aria-hidden="true" className="size-4" /> حال‌وهوا
              </Link>
              <Link href="/discover/mood?mode=topic" scroll={false} aria-current={isTopic ? "page" : undefined} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary sm:min-h-12 sm:px-4 sm:text-sm ${isTopic ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Lightbulb aria-hidden="true" className="size-4" /> موضوع
              </Link>
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {selectedCollection ? (
              <DiscoveryResults
                id={isTopic ? "topic-results" : "mood-results"}
                title={selectedCollection.title}
                slugs={selectedCollection.bookSlugs}
                books={books}
                showChangeLink={false}
              />
            ) : (
              <DiscoveryChoices
                kind={selectedKind}
                basePath="/discover/mood"
                items={collections.map(({ slug, title, description }) => ({ slug, title, description }))}
                selected={selected}
              >
                {null}
              </DiscoveryChoices>
            )}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
