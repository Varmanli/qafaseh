import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Compass, Heart, ListOrdered, Search, Sparkles, WandSparkles } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "کشف کتاب",
    description: "با حال و سلیقه‌ات کتاب بعدی‌ات را در قفسه پیدا کن.",
    path: "/discover",
  });
}

const journeys = [
  {
    href: "/discover/questions",
    eyebrow: "پیشنهاد شخصی",
    title: "سه سؤال، سه کتاب",
    description: "سه انتخاب کوتاه کن تا قفسه کتاب‌هایی متناسب با سلیقه‌ات پیدا کند.",
    action: "شروع انتخاب",
    Icon: WandSparkles,
    number: "۰۱",
  },
  {
    href: "/discover/mood",
    eyebrow: "بر اساس حال و سلیقه",
    title: "امروز چی دلت می‌خواد بخونی؟",
    description: "حال‌وهوایت یا موضوعی را انتخاب کن و پیشنهادهای مرتبط را ببین.",
    action: "انتخاب حال‌وهوا",
    Icon: Heart,
    number: "۰۲",
  },
  {
    href: "/discover/paths",
    eyebrow: "قدم‌به‌قدم",
    title: "از کجا شروع کنم؟",
    description: "یک مسیر مطالعه انتخاب کن و کتاب‌ها را به ترتیب پیشنهادی بخوان.",
    action: "دیدن مسیرها",
    Icon: ListOrdered,
    number: "۰۳",
  },
];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const query = new URLSearchParams();
  for (const key of ["mood", "topic"] as const) {
    const value = first(params[key]);
    if (value) query.set(key, value);
  }
  if (first(params.pick) === "random") {
    const destination = new URLSearchParams();
    destination.set("pick", "random");
    const roll = first(params.roll);
    if (roll) destination.set("roll", roll);
    redirect(`/discover/paths?${destination.toString()}`);
  }
  if (first(params.start) === "1") redirect("/discover/paths");
  if (query.size) redirect(`/discover/mood?${query.toString()}`);

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:space-y-10 sm:px-6 sm:py-9">
        <header className="relative isolate overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-[0_18px_50px_-32px_rgba(0,0,0,0.22)] sm:rounded-[2rem]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-primary/10 blur-[80px] sm:size-96" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 size-64 rounded-full bg-primary/[0.06] blur-[80px]" />
          <div className="grid gap-7 p-5 sm:gap-8 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.68fr)] lg:items-center lg:gap-12 lg:p-10">
            <div>
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.07] px-3 text-xs font-bold text-primary">
                <Compass aria-hidden="true" className="size-4" />
                کشف کتاب در قفسه
              </span>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.7rem]">کتاب بعدی‌ات را پیدا کن</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">بین کتاب‌های قفسه بگرد و چیزی متناسب با حال، وقت و سلیقه‌ات پیدا کن.</p>
              <form action="/books" method="get" role="search" className="mt-6 flex max-w-2xl items-stretch gap-2 rounded-2xl border border-border/60 bg-background/75 p-1.5 shadow-sm backdrop-blur transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 sm:mt-7">
                <label htmlFor="discover-search" className="sr-only">جست‌وجوی کتاب، نویسنده یا موضوع</label>
                <div className="flex min-w-0 flex-1 items-center gap-3 px-2 sm:px-3">
                  <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <input id="discover-search" name="q" type="search" placeholder="نام کتاب، نویسنده یا موضوع..." className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0" />
                </div>
                <button type="submit" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><span>جست‌وجو</span><ArrowLeft aria-hidden="true" className="size-4" /></button>
              </form>
            </div>

            <div className="relative overflow-hidden rounded-[1.5rem] border border-primary/15 bg-primary-deep p-5 text-white shadow-[0_20px_50px_-30px_rgba(0,0,0,0.4)] sm:p-6">
              <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-12 size-40 rounded-full border border-white/10" />
              <div aria-hidden="true" className="pointer-events-none absolute -left-2 -top-6 size-28 rounded-full border border-white/10" />
              <div className="relative">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white"><Sparkles aria-hidden="true" className="size-5" /></span>
                <p className="mt-4 text-xs font-bold text-white/65">سه راه برای پیدا کردن کتاب بعدی</p>
                <p className="mt-1 text-lg font-black">از هرجا دوست داری شروع کن</p>
                <p className="mt-2 text-sm leading-6 text-white/70">هر انتخاب در صفحه‌ای جدا و خلوت منتظر توست.</p>
              </div>
            </div>
          </div>
        </header>

        <section aria-label="روش‌های کشف کتاب" className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          {journeys.map(({ href, eyebrow, title, description, action, Icon, number }) => (
            <Link key={href} href={href} className="group relative flex min-h-56 flex-col overflow-hidden rounded-[1.5rem] border border-border/60 bg-card p-5 shadow-sm outline-none transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary sm:min-h-60 sm:p-6">
              <span aria-hidden="true" className="absolute -left-8 -top-10 size-32 rounded-full bg-primary/[0.045] transition-transform duration-300 group-hover:scale-125" />
              <div className="relative flex items-center justify-between">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon aria-hidden="true" className="size-5" /></span>
                <span className="text-xs font-black tabular-nums text-muted-foreground/60">{number}</span>
              </div>
              <div className="relative mt-5 flex-1">
                <p className="text-xs font-bold text-primary">{eyebrow}</p>
                <h2 className="mt-1.5 text-lg font-black leading-7 tracking-tight sm:text-xl">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
              <span className="relative mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">{action}<ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1" /></span>
            </Link>
          ))}
        </section>
      </main>
    </PublicShell>
  );
}
