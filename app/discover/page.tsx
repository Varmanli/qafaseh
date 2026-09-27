import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  Heart,
  ListOrdered,
  Search,
  Sparkles,
  WandSparkles,
} from "lucide-react";

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
    description:
      "سه انتخاب کوتاه کن تا قفسه کتاب‌هایی متناسب با سلیقه‌ات پیدا کند.",
    action: "شروع انتخاب",
    Icon: WandSparkles,
    number: "۰۱",
  },
  {
    href: "/discover/mood",
    eyebrow: "بر اساس حال و سلیقه",
    title: "امروز چی دلت می‌خواد بخونی؟",
    description:
      "حال‌وهوایت یا موضوعی را انتخاب کن و پیشنهادهای مرتبط را ببین.",
    action: "انتخاب حال‌وهوا",
    Icon: Heart,
    number: "۰۲",
  },
  {
    href: "/discover/paths",
    eyebrow: "قدم‌به‌قدم",
    title: "از کجا شروع کنم؟",
    description:
      "یک مسیر مطالعه انتخاب کن و کتاب‌ها را به ترتیب پیشنهادی بخوان.",
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
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
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
      <main
        dir="rtl"
        className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:space-y-10 sm:px-6 sm:py-9"
      >
        <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary-deep text-white shadow-[0_28px_70px_-32px_rgba(15,35,28,0.72)] sm:rounded-[2rem]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 -top-40 -z-10 size-[28rem] rounded-full bg-white/[0.08] blur-[90px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-48 left-1/4 -z-10 size-[30rem] rounded-full bg-[#b5d5c6]/[0.09] blur-[100px]"
          />
          <div className="relative grid gap-2 px-5 pb-5 pt-6 sm:gap-4 sm:px-9 sm:pb-9 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] lg:items-center lg:gap-8 lg:px-12 lg:py-12">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-white/70 sm:text-sm">
                <Compass aria-hidden="true" className="size-4 text-[#c4decf]" />
                <span>قفسه، راهنمای انتخاب کتاب</span>
              </span>
              <h1 className="mt-4 max-w-2xl text-[2rem] font-black leading-[1.35] tracking-tight text-white sm:mt-5 sm:text-4xl sm:leading-[1.3] lg:text-[3.5rem]">
                کتاب بعدی‌ات را
                <span className="block text-[#c4decf]">پیدا کن.</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/65 sm:mt-4 sm:text-base sm:leading-8">
                بین کتاب‌های قفسه بگرد و چیزی متناسب با حال، وقت و سلیقه‌ات پیدا
                کن.
              </p>
              <form
                action="/books"
                method="get"
                role="search"
                className="mt-6 flex max-w-2xl items-center gap-1.5 rounded-2xl border border-white/15 bg-white p-1.5 text-foreground shadow-[0_18px_38px_-22px_rgba(0,0,0,0.6)] transition focus-within:ring-2 focus-within:ring-white/50 sm:mt-8 sm:gap-2 sm:rounded-[1.25rem] sm:p-2"
              >
                <label htmlFor="discover-search" className="sr-only">
                  جست‌وجوی کتاب، نویسنده یا موضوع
                </label>
                <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 sm:min-h-12 sm:gap-3 sm:px-3">
                  <Search
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <input
                    id="discover-search"
                    name="q"
                    type="search"
                    placeholder="نام کتاب، نویسنده یا موضوع..."
                    className="h-11 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-0 sm:h-12 sm:text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary-deep px-3 text-xs font-bold text-white outline-none transition-all hover:bg-[#357764] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-12 sm:gap-2 sm:px-5 sm:text-sm"
                >
                  <span>جست‌وجو</span>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                </button>
              </form>
            </div>

            <div aria-hidden="true" className="group relative hidden min-h-[25rem] items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] shadow-inner shadow-white/[0.025] lg:flex">
              <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[#c4decf]/[0.14] blur-[80px] transition-transform duration-700 group-hover:scale-110" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-[#d9c28e]/[0.1] blur-[80px]" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
              <div className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-bold text-white/80 shadow-lg backdrop-blur">
                <Sparkles className="size-4 text-[#d9c28e]" />
                یک کشف تازه
              </div>
              <div className="absolute bottom-6 right-6 z-20 max-w-40 text-right">
                <p className="text-[10px] font-bold text-white/50">قفسه پیشنهاد می‌کند</p>
                <p className="mt-1 text-sm font-black leading-6 text-white/90">از یک فصل تازه شروع کن</p>
              </div>
              <div className="relative h-[19rem] w-[19rem]">
                <div className="absolute left-[calc(50%-7rem)] top-1/2 h-56 w-36 -translate-y-1/2 -rotate-[16deg] rounded-xl border border-white/10 bg-[#668f7d] shadow-[0_28px_50px_-22px_rgba(0,0,0,0.65)]" />
                <div className="absolute left-[calc(50%-1rem)] top-1/2 h-56 w-36 -translate-y-1/2 rotate-[15deg] rounded-xl border border-white/10 bg-[#577c73] shadow-[0_28px_50px_-22px_rgba(0,0,0,0.65)]" />
                <div className="absolute left-1/2 top-1/2 h-64 w-44 -translate-x-1/2 -translate-y-1/2 rotate-[5deg] rounded-xl border border-white/20 bg-gradient-to-br from-[#d5bd82] via-[#c6a86b] to-[#ac8c50] shadow-[0_35px_65px_-24px_rgba(0,0,0,0.72)] transition-transform duration-700 group-hover:-translate-y-[54%]">
                  <div className="absolute inset-3 rounded-lg border border-[#342d20]/20" />
                  <div className="absolute inset-x-7 top-[37%] border-y border-[#342d20]/25 py-4 text-center text-[#342d20]">
                    <span className="block text-[10px] font-medium tracking-[0.18em]">روایتی از</span>
                    <span className="mt-2 block text-xl font-black">فصل تازه</span>
                  </div>
                  <span className="absolute bottom-6 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#342d20]/40" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <section
          aria-label="روش‌های کشف کتاب"
          className="grid gap-4 lg:grid-cols-3 lg:gap-5"
        >
          {journeys.map(
            ({ href, eyebrow, title, description, action, Icon, number }) => (
              <Link
                key={href}
                href={href}
                className="group relative flex min-h-56 flex-col overflow-hidden rounded-[1.5rem] border border-border/60 bg-card p-5 shadow-sm outline-none transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary sm:min-h-60 sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-8 -top-10 size-32 rounded-full bg-primary/[0.045] transition-transform duration-300 group-hover:scale-125"
                />
                <div className="relative flex items-center justify-between">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-xs font-black tabular-nums text-muted-foreground/60">
                    {number}
                  </span>
                </div>
                <div className="relative mt-5 flex-1">
                  <p className="text-xs font-bold text-primary">{eyebrow}</p>
                  <h2 className="mt-1.5 text-lg font-black leading-7 tracking-tight sm:text-xl">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
                <span className="relative mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                  {action}
                  <ArrowLeft
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:-translate-x-1"
                  />
                </span>
              </Link>
            ),
          )}
        </section>
      </main>
    </PublicShell>
  );
}
