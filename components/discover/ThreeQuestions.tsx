"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { recommendQuizBooks } from "@/app/discover/actions";
import BookCoverImage from "@/components/books/BookCoverImage";
import { getPublicBookHref } from "@/lib/book/public-href";
import type { QuizAnswers, QuizRecommendation } from "@/lib/book/discover-quiz";

type Option = { slug: string; title: string };
type Question = {
  key: keyof QuizAnswers;
  title: string;
  description: string;
  shortTitle: string;
  options: (Option & { description: string })[];
};

const optionDescriptions: Record<string, string> = {
  literary: "قصه‌ها و شخصیت‌هایی که یادت می‌مونن",
  reflective: "یه کتاب که بعدش کلی بهش فکر کنی",
  exciting: "ماجرا و تعلیق تا صفحهٔ آخر",
  dark: "راز و اتفاق‌های غیرمنتظره",
  calm: "یه قصهٔ نرم برای وقت‌های آروم",
  thoughtful: "داستانی که تا مدت‌ها توی ذهنت می‌مونه",
  thrilling: "از اون کتاب‌ها که نمی‌تونی زمین بذاری",
  elsewhere: "چند ساعت دور شدن از دنیای خودمون",
  weighty: "یه موضوع جدی برای عمیق‌تر خوندن",
  short: "برای وقت‌هایی که فرصت زیادی نداری",
  medium: "یه انتخاب متعادل برای چند نوبت مطالعه",
  long: "برای وقتی که دلت یه سفر طولانی می‌خواد",
  any: "بذار قفسه یه چیزی غافلگیرکننده پیدا کنه",
};

const optionTitles: Record<keyof QuizAnswers, Record<string, string>> = {
  kind: {
    literary: "یه کتاب ادبی",
    reflective: "یه کتاب تأمل‌برانگیز",
    exciting: "یه کتاب پرماجرا",
    any: "هرچی تو پیشنهاد بدی",
  },
  mood: {
    dark: "یه فضای تیره و رازآلود",
    calm: "یه قصهٔ آروم",
    thoughtful: "یه داستان تأمل‌برانگیز",
    thrilling: "یه قصهٔ نفس‌گیر",
    elsewhere: "یه سفر به دنیای دیگه",
    weighty: "یه کتاب جدی و عمیق",
    any: "بذار قفسه غافلگیرم کنه",
  },
  commitment: {
    short: "یه کتاب جمع‌وجور",
    medium: "یه کتاب با حجم معمولی",
    long: "یه داستان بلند و مفصل",
    any: "زمانش مهم نیست",
  },
};

export default function ThreeQuestions({
  kinds,
  moods,
  commitments,
}: {
  kinds: Option[];
  moods: Option[];
  commitments: Option[];
}) {
  const questions: Question[] = [
    {
      key: "kind",
      shortTitle: "مدل کتاب",
      title: "الان دلت چه جور کتابی می‌خواد؟",
      description: "ادبی، فکری یا پرماجرا؟ هرکدوم بیشتر به حالت می‌خوره انتخاب کن.",
      options: [...kinds, { slug: "any", title: "فرقی نداره" }].map((option) => ({
        ...option,
        title: optionTitles.kind[option.slug] ?? option.title,
        description: optionDescriptions[option.slug] ?? "یک انتخاب خوب از قفسه",
      })),
    },
    {
      key: "mood",
      shortTitle: "حس‌وحال",
      title: "دوست داری کتاب چه حالی بهت بده؟",
      description: "حس‌وحالی رو انتخاب کن که دلت می‌خواد موقع خوندن همراهت باشه.",
      options: [...moods, { slug: "any", title: "فرقی نداره" }].map((option) => ({
        ...option,
        title: optionTitles.mood[option.slug] ?? option.title,
        description: optionDescriptions[option.slug] ?? "بگذار قفسه حال‌وهوایت را پیدا کند",
      })),
    },
    {
      key: "commitment",
      shortTitle: "وقت خوندن",
      title: "چقدر می‌خوای پای کتاب وقت بذاری؟",
      description: "این روزها وقتت برای یه کتاب جمع‌وجوره یا یه داستان بلند؟",
      options: [...commitments, { slug: "any", title: "مهم نیست" }].map((option) => ({
        ...option,
        title: optionTitles.commitment[option.slug] ?? option.title,
        description: optionDescriptions[option.slug] ?? "هر اندازه‌ای که داستان لازم داشته باشد",
      })),
    },
  ];

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [results, setResults] = useState<QuizRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const question = questions[step];
  const progress = results ? 100 : Math.round(((step + 1) / questions.length) * 100);

  function restart() {
    setAnswers({});
    setResults(null);
    setError(null);
    setStep(0);
  }

  function recommend(excludedIds: string[] = []) {
    if (!answers.kind || !answers.mood || !answers.commitment) return;
    const complete = answers as QuizAnswers;
    setError(null);
    startTransition(async () => {
      try {
        const books = await recommendQuizBooks(complete, excludedIds);
        if (books.length === 3) setResults(books);
        else setError(excludedIds.length
          ? "فعلاً سه کتاب تازهٔ دیگر در دسترس نیست. انتخاب‌هایت را تغییر بده یا بعداً دوباره امتحان کن."
          : "فعلاً کتاب کافی برای این پیشنهاد در دسترس نیست. دوباره امتحان کن.");
      } catch {
        setError("پیشنهادها آماده نشدند. دوباره امتحان کن.");
      }
    });
  }

  const answerSummary = questions.map((item) => ({
    label: item.shortTitle,
    value: item.options.find((option) => option.slug === answers[item.key])?.title,
  })).filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <section
      id="three-questions"
      aria-labelledby="three-questions-title"
      dir="rtl"
      className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-[0_22px_70px_-42px_rgba(0,0,0,0.32)] sm:rounded-[2rem]"
    >
      <div className="relative isolate overflow-hidden border-b border-border/60 bg-gradient-to-l from-primary/[0.09] via-card to-card px-5 py-5 sm:px-8 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-20 -z-10 size-52 rounded-full border border-primary/10 sm:size-64" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-1 -top-11 -z-10 size-36 rounded-full border border-primary/10 sm:size-44" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15 sm:size-12">
              {results ? <Sparkles aria-hidden="true" className="size-5" /> : <BookOpen aria-hidden="true" className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-primary">{results ? "پیشنهادهای قفسه آماده‌اند" : "پیشنهادگر کتاب قفسه"}</p>
              <h2 id="three-questions-title" className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                {results ? "این سه کتاب را امتحان کن" : "سه سؤال، سه کتاب"}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {results ? "بر اساس چیزهایی که انتخاب کردی؛ هرکدام را باز کن و بیشتر بشناس." : "سه انتخاب کوتاه؛ یک شروع تازه برای کتاب بعدی‌ات."}
              </p>
            </div>
          </div>
          {(step > 0 || results) && (
            <button
              type="button"
              disabled={pending}
              onClick={restart}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 text-xs font-bold text-muted-foreground outline-none transition-colors hover:border-primary/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> از اول
            </button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-8">
        <div className="mb-7">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-muted-foreground">{results ? "پیشنهاد کامل شد" : `مرحلهٔ ${(step + 1).toLocaleString("fa-IR")} از ${questions.length.toLocaleString("fa-IR")}`}</p>
            <p className="text-xs font-black tabular-nums text-primary">{progress.toLocaleString("fa-IR")}٪</p>
          </div>
          <div
            role="progressbar"
            aria-label="پیشرفت پیشنهاد کتاب"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="مراحل انتخاب">
            {questions.map((item, index) => {
              const complete = Boolean(answers[item.key]);
              const current = !results && index === step;
              return (
                <li key={item.key} aria-current={current ? "step" : undefined} className={`flex min-w-0 items-center gap-2 text-[10px] font-bold sm:text-xs ${current ? "text-primary" : complete || results ? "text-foreground/70" : "text-muted-foreground/65"}`}>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-[10px] tabular-nums transition-colors ${current ? "border-primary bg-primary text-primary-foreground" : complete || results ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-background"}`}>
                    {complete || results ? <Check aria-hidden="true" className="size-3.5" /> : (index + 1).toLocaleString("fa-IR")}
                  </span>
                  <span className="truncate">{item.shortTitle}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {results ? (
          <div aria-live="polite">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-lg font-black sm:text-xl">پیشنهادهای مخصوص تو</h3>
                <p className="mt-1 text-sm text-muted-foreground">سه کتاب برای شروع مسیر خواندنت</p>
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="انتخاب‌های شما">
                {answerSummary.map((item) => <span key={item.label} className="rounded-full border border-primary/15 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-bold text-primary">{item.value}</span>)}
              </div>
            </div>

            {pending ? (
              <div role="status" aria-label="داریم پیشنهادهای تازه را پیدا می‌کنیم" className="grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((index) => <div key={index} className="animate-pulse rounded-2xl border border-border/60 p-3"><div className="mx-auto aspect-[2/3] max-w-[210px] rounded-xl bg-muted" /><div className="mt-3 h-4 w-2/3 rounded bg-muted" /><div className="mt-2 h-3 w-1/2 rounded bg-muted" /></div>)}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((book, index) => {
                  const href = getPublicBookHref(book);
                  if (!href) return null;
                  return (
                    <Link key={book.id} href={href} className="group overflow-hidden rounded-[1.4rem] border border-border/70 bg-background/55 p-3 outline-none transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary">
                      <div className="relative mx-auto aspect-[2/3] w-full max-w-[210px] overflow-hidden rounded-[1rem] bg-muted">
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-primary/5"><BookOpen aria-hidden="true" className="size-8 text-muted-foreground/35" /></div>
                        <BookCoverImage src={book.coverImage} alt="" fill sizes="(max-width: 640px) 72vw, (max-width: 1024px) 38vw, 210px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                        <span className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-xs font-black tabular-nums text-white shadow-sm backdrop-blur">{(index + 1).toLocaleString("fa-IR")}</span>
                      </div>
                      <div className="px-1 pb-1 pt-4">
                        <p className="line-clamp-2 min-h-12 text-sm font-black leading-6 transition-colors group-hover:text-primary">{book.title}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
                        {book.reason && <p className="mt-3 flex min-h-8 items-start gap-1.5 border-t border-border/60 pt-2.5 text-xs font-bold leading-5 text-primary"><Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{book.reason}</p>}
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">دیدن کتاب <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1" /></span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-700 dark:text-amber-200">{error}</p>}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border/60 pt-5">
              <button type="button" disabled={pending} onClick={() => recommend(results.map((book) => book.id))} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-50"><Sparkles aria-hidden="true" className="size-4" /> سه پیشنهاد دیگر</button>
              <button type="button" disabled={pending} onClick={() => { setResults(null); setError(null); setStep(0); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none transition-colors hover:border-primary/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">ویرایش انتخاب‌ها</button>
            </div>
          </div>
        ) : pending ? (
          <div role="status" aria-live="polite" className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-5 sm:p-7">
            <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles aria-hidden="true" className="size-5 animate-pulse" /></span><div><p className="text-sm font-black">داریم کتاب‌ها را می‌گردیم...</p><p className="mt-1 text-xs text-muted-foreground">چند لحظه صبر کن تا سه پیشنهاد آماده شود.</p></div></div>
            <div className="mt-5 grid grid-cols-3 gap-3">{[0, 1, 2].map((index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />)}</div>
          </div>
        ) : (
          <div className="min-h-[360px]" key={step}>
            <div className="mb-6">
              <p className="text-xs font-bold text-primary">انتخاب {`۰${step + 1}`}</p>
              <h3 className="mt-1.5 text-xl font-black tracking-tight sm:text-2xl">{question.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{question.description}</p>
            </div>
            <fieldset>
              <legend className="sr-only">{question.title}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {question.options.map((option, index) => {
                  const id = `quiz-${question.key}-${option.slug}`;
                  const selected = answers[question.key] === option.slug;
                  return (
                    <div key={option.slug} className="relative">
                      <input
                        id={id}
                        type="radio"
                        name={`quiz-${question.key}`}
                        value={option.slug}
                        checked={selected}
                        onChange={() => { setAnswers((previous) => ({ ...previous, [question.key]: option.slug })); setError(null); }}
                        className="peer sr-only"
                      />
                      <label htmlFor={id} className="group flex min-h-[88px] cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-background/65 p-3.5 text-right outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.025] peer-checked:border-primary/50 peer-checked:bg-primary/[0.07] peer-checked:shadow-[0_10px_28px_-22px_var(--primary)] peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 sm:min-h-24 sm:p-4">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-xl border text-xs font-black tabular-nums transition-colors ${selected ? "border-primary/20 bg-primary text-primary-foreground" : "border-border/60 bg-card text-muted-foreground group-hover:text-primary"}`}>
                          {selected ? <Check aria-hidden="true" className="size-4" /> : (index + 1).toLocaleString("fa-IR")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black leading-6 text-foreground">{option.title}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                        </span>
                        <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{selected && <Check className="size-3" />}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {error && <p role="alert" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-700 dark:text-amber-200">{error}</p>}
            <div className="mt-7 flex items-center justify-between gap-3 border-t border-border/60 pt-5">
              {step > 0 ? (
                <button type="button" onClick={() => { setStep(step - 1); setError(null); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"><ArrowRight aria-hidden="true" className="size-4" /> برگشت</button>
              ) : <span className="text-xs text-muted-foreground">هر وقت خواستی می‌توانی برگردی.</span>}
              <button
                type="button"
                disabled={!answers[question.key]}
                onClick={() => step < questions.length - 1 ? setStep(step + 1) : recommend()}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step < questions.length - 1 ? "ادامه" : "دیدن پیشنهادها"}<ArrowLeft aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
