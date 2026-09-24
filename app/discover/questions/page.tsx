import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Sparkles, WandSparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import ThreeQuestions from "@/components/discover/ThreeQuestions";
import { quizCommitments, quizKinds, quizMoodOptions } from "@/lib/book/discover-config";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "سه سؤال، سه کتاب | کشف کتاب",
    description: "به سه سؤال کوتاه جواب بده و سه کتاب متناسب با سلیقه‌ات پیدا کن.",
    path: "/discover/questions",
  });
}

export default function DiscoverQuestionsPage() {
  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-9">
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep p-5 text-white shadow-[0_24px_70px_-38px_rgba(43,98,82,0.6)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 -z-10 size-64 rounded-full border border-white/10 sm:size-80" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-2 -top-12 -z-10 size-40 rounded-full border border-white/10 sm:size-52" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-1/3 -z-10 size-64 rounded-full bg-white/[0.06] blur-3xl" />
          <Link href="/discover" className="inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-bold text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white"><ArrowRight aria-hidden="true" className="size-4" /> بازگشت به روش‌های کشف</Link>
          <div className="mt-6 grid items-center gap-7 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
            <div>
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 text-xs font-bold text-white/85"><WandSparkles aria-hidden="true" className="size-4" /> پیشنهادگر کتاب قفسه</span>
              <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">انتخاب کتاب بعدی می‌تونه آسون باشه</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/70 sm:text-base">سه انتخاب کوتاه کن؛ قفسه سلیقه‌ات را پیدا می‌کند و سه کتاب برای شروع پیشنهاد می‌دهد.</p>
            </div>
            <div aria-hidden="true" className="relative mx-auto grid size-36 shrink-0 place-items-center sm:size-44">
              <span className="absolute inset-0 rounded-full border border-white/15" />
              <span className="absolute inset-4 rounded-full border border-dashed border-white/20" />
              <span className="grid size-20 place-items-center rounded-[1.7rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur sm:size-24"><BookOpenCheck className="size-10 text-white sm:size-12" /></span>
              <span className="absolute right-2 top-4 grid size-9 place-items-center rounded-xl border border-white/15 bg-white/10"><Sparkles className="size-4" /></span>
              <span className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold">۳ پیشنهاد</span>
            </div>
          </div>
        </header>
        <ThreeQuestions
          kinds={quizKinds.map(({ slug, title }) => ({ slug, title }))}
          moods={quizMoodOptions.map(({ slug, title }) => ({ slug, title }))}
          commitments={quizCommitments.map(({ slug, title }) => ({ slug, title }))}
        />
      </main>
    </PublicShell>
  );
}
