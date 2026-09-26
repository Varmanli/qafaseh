import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen, ShieldCheck } from "lucide-react";

import PublicShell from "@/components/PublicShell";
import ContactForm from "@/components/contact/ContactForm";
import { getStaticPageBySlug } from "@/lib/static-pages/service";
import { buildStaticPageMetadata } from "@/lib/static-pages/metadata";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata("contact");
}

type ContactSearchParams = { topic?: string | string[]; bookTitle?: string | string[] };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<ContactSearchParams>;
}) {
  const page = await getStaticPageBySlug("contact");
  if (!page) notFound();
  const params = await searchParams;
  const topic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const bookTitle = (Array.isArray(params.bookTitle) ? params.bookTitle[0] : params.bookTitle)?.trim().slice(0, 200) ?? "";
  const initialTopic = ["book", "criticism", "suggestion", "problem", "cooperation", "other"].includes(topic ?? "")
    ? topic as "book" | "criticism" | "suggestion" | "problem" | "cooperation" | "other"
    : "";

  return (
    <PublicShell>
      <main dir="rtl" className="relative isolate mx-auto max-w-7xl overflow-hidden px-4 py-9 sm:px-6 sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-1/4 -z-10 h-80 w-80 rounded-full bg-primary/15 blur-[100px]" />
        <div aria-hidden="true" className="pointer-events-none absolute top-96 -left-32 -z-10 h-72 w-72 rounded-full bg-accent-book/10 blur-[100px]" />

        <div className="mx-auto grid max-w-6xl items-stretch gap-4 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.6fr)] lg:gap-6">
          <aside className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-[radial-gradient(ellipse_at_top_left,rgba(125,226,180,.13),transparent_42%),linear-gradient(145deg,#102820,#0c1b16)] p-6 text-white shadow-2xl shadow-black/10 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></span>
              <p className="mt-7 text-xs font-bold tracking-wide text-primary">در ارتباط با قفسه</p>
              <h2 className="mt-2 text-2xl font-black leading-relaxed">هر پیام، یک قدم برای بهتر شدن</h2>
              <p className="mt-3 text-sm leading-8 text-white/65">از معرفی کتابی که جایش خالی است تا یک انتقاد یا ایده‌ی تازه؛ با دقت می‌خوانیم و پیگیری می‌کنیم.</p>
              <ul className="mt-7 space-y-3 text-sm text-white/85">
                {["پیشنهاد کتاب و تکمیل اطلاعات آن", "گزارش مشکل یا ارسال بازخورد", "ایده‌ها و پیشنهادهای همکاری"].map((item, index) => <li key={item} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-primary">{["۰۱", "۰۲", "۰۳"][index]}</span>{item}</li>)}
              </ul>
              <div className="mt-8 flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-6 text-white/55"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />اطلاعات شما فقط برای پیگیری همین پیام استفاده می‌شود.</div>
            </div>
          </aside>

          <ContactForm initialTopic={initialTopic} initialBookTitle={bookTitle} />
        </div>
      </main>
    </PublicShell>
  );
}
