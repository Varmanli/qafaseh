import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Bookmark, Sparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import ReadingListCard from "@/components/lists/ReadingListCard";
import { getReadingListsOverview } from "@/lib/book/reading-lists-service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "همهٔ لیست‌های مطالعه",
    description: "مسیرهای ترتیبی و مجموعه‌های کتاب را یک‌جا ببین و انتخابی متناسب با سلیقه‌ات پیدا کن.",
    path: "/lists/all",
  });
}

export default async function AllReadingListsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedGroup = Array.isArray(params.group) ? params.group[0] : params.group;
  const lists = await getReadingListsOverview();
  const allGroups = [...new Set(lists.map((list) => list.hubGroup))];
  const selectedGroup = allGroups.find((group) => group === requestedGroup);
  const groups = selectedGroup ? [selectedGroup] : allGroups;
  const visibleLists = selectedGroup ? lists.filter((list) => list.hubGroup === selectedGroup) : lists;

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-7 px-4 py-6 sm:space-y-9 sm:px-6 sm:py-9">
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep p-5 text-white shadow-[0_24px_70px_-38px_rgba(43,98,82,0.6)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 -z-10 size-64 rounded-full border border-white/10 sm:size-80" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-2 -top-12 -z-10 size-40 rounded-full border border-white/10 sm:size-52" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/3 -z-10 size-64 rounded-full bg-white/[0.06] blur-3xl" />
          <Link href="/lists" className="inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-bold text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white"><ArrowRight aria-hidden="true" className="size-4" /> بازگشت به مسیرهای مطالعه</Link>
          <div className="mt-5 grid items-center gap-6 sm:mt-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
            <div>
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 text-xs font-bold text-white/85"><Bookmark aria-hidden="true" className="size-4" /> فهرست کامل</span>
              <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">{selectedGroup ? `لیست‌های ${selectedGroup}` : "همهٔ لیست‌های مطالعه"}</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/70 sm:text-base">{selectedGroup ? `همهٔ لیست‌های دستهٔ «${selectedGroup}» را ببین و یکی را انتخاب کن.` : "همهٔ پیشنهادها را یک‌جا ببین و لیستی را انتخاب کن که بیشتر به دلت می‌نشیند."}</p>
              <span className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3 text-xs font-bold text-white/75"><BookOpen aria-hidden="true" className="size-4" /> {visibleLists.length.toLocaleString("fa-IR")} لیست آماده</span>
            </div>
            <div aria-hidden="true" className="relative mx-auto hidden size-36 shrink-0 place-items-center sm:grid sm:size-44">
              <span className="absolute inset-0 rounded-full border border-white/15" />
              <span className="absolute inset-4 rounded-full border border-dashed border-white/20" />
              <div className="relative grid size-20 place-items-center rounded-[1.7rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur sm:size-24"><Sparkles className="size-10 text-white sm:size-12" /></div>
              <span className="absolute bottom-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold">انتخاب با سلیقهٔ تو</span>
            </div>
          </div>
        </header>

        {groups.length ? groups.map((group, groupIndex) => {
          const groupLists = lists.filter((list) => list.hubGroup === group);
          return (
            <section key={group} aria-labelledby={`all-list-group-${groupIndex}`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4 sm:mb-5 sm:pb-5">
                <div>
                  <p className="text-xs font-bold text-primary">دستهٔ {(groupIndex + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</p>
                  <h2 id={`all-list-group-${groupIndex}`} className="mt-1 text-xl font-black sm:text-2xl">{group}</h2>
                </div>
                <span className="inline-flex min-h-8 items-center rounded-full border border-border/60 bg-card px-3 text-xs font-bold text-muted-foreground">{groupLists.length.toLocaleString("fa-IR")} لیست</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                {groupLists.map((list) => <ReadingListCard key={list.slug} list={list} />)}
              </div>
            </section>
          );
        }) : <p className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">فعلاً لیستی در دسترس نیست.</p>}
      </main>
    </PublicShell>
  );
}
