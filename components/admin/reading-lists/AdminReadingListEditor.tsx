"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Check, ChevronDown, ChevronUp,
  Eye, FileText, Globe2, Layers3, Link2, Loader2, Plus, Search,
  Sparkles, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import BookCoverImage from "@/components/books/BookCoverImage";
import { slugify } from "@/lib/book/slug";
import type { getAdminReadingList, getAdminRelatedOptions } from "@/lib/admin/reading-lists";

type Existing = NonNullable<Awaited<ReturnType<typeof getAdminReadingList>>>;
type Option = Awaited<ReturnType<typeof getAdminRelatedOptions>>[number];
type Book = { id: string; title: string; author: string; coverImage: string | null };
type Item = Book & { note: string; difficulty: "EASY" | "MEDIUM" | "HARD" | null };

const groups = ["جهان‌های خیال", "مسیرهای موضوعی", "ادبیات جهان", "نویسندگان", "فلسفه و اندیشه", "ژانرها", "پیشنهادهای قفسه"];
const inputClass = "min-h-12 w-full rounded-2xl border border-border-strong bg-background/70 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary focus:ring-2 focus:ring-primary/15";
const cardClass = "rounded-[1.7rem] border border-border bg-card p-5 shadow-[0_18px_55px_-45px_rgba(0,0,0,0.45)] sm:p-7";

function SectionHeading({ number, icon: Icon, title, description }: {
  number: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return <div className="mb-6 flex items-start gap-3 border-b border-border pb-5">
    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center gap-2"><span className="text-[11px] font-bold tracking-[0.16em] text-primary">{number}</span><h2 className="text-lg font-black text-foreground">{title}</h2></div>
      <p className="text-xs leading-6 text-muted-foreground sm:text-sm">{description}</p>
    </div>
  </div>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-2">
    <span className="flex items-center justify-between gap-2 text-sm font-bold text-foreground">
      <span>{label}{required && <span className="mr-1 text-destructive">*</span>}</span>
      {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
    </span>
    {children}
  </label>;
}

export default function AdminReadingListEditor({ initial, relatedOptions }: { initial?: Existing; relatedOptions: Option[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [audience, setAudience] = useState(initial?.audience ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [hubGroup, setHubGroup] = useState(initial?.hubGroup ?? groups[0]);
  const [mode, setMode] = useState<"ORDERED" | "UNORDERED">(initial?.mode ?? "ORDERED");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [items, setItems] = useState<Item[]>(() => initial?.items.map((item) => ({
    id: item.bookId, title: item.title, author: item.author, coverImage: item.coverImage,
    note: item.note ?? "", difficulty: item.difficulty,
  })) ?? []);
  const [relatedIds, setRelatedIds] = useState<string[]>(initial?.relatedListIds ?? []);
  const [bookQuery, setBookQuery] = useState("");
  const [bookMatches, setBookMatches] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bookQuery.trim().length < 2) { setBookMatches([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/admin/reading-lists/books?q=${encodeURIComponent(bookQuery.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (response.ok) setBookMatches(data.books ?? []);
        else toast.error(data.error || "جست‌وجوی کتاب ناموفق بود");
      } catch (error) { if ((error as Error).name !== "AbortError") toast.error("جست‌وجوی کتاب ناموفق بود"); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [bookQuery]);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    setItems((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  async function save(status: "DRAFT" | "PUBLISHED") {
    setSaving(true);
    try {
      const payload = {
        title: title.trim(), subtitle: subtitle.trim() || null, slug: slug.trim(), description: description.trim(),
        audience: audience.trim() || null, category: category.trim(), hubGroup,
        mode, status, featured, seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        items: items.map((item) => ({ bookId: item.id, note: item.note.trim() || null, difficulty: item.difficulty })),
        relatedListIds: relatedIds,
      };
      const response = await fetch(initial ? `/api/admin/reading-lists/${initial.id}` : "/api/admin/reading-lists", {
        method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ذخیره لیست ناموفق بود");
      toast.success(data.message || "لیست ذخیره شد");
      if (!initial) router.push(`/admin/reading-lists/${data.id}`);
      else router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد"); }
    finally { setSaving(false); }
  }

  return <div dir="rtl" className="mx-auto max-w-[1480px] space-y-6 pb-12">
    <nav aria-label="مسیر صفحه" className="flex items-center gap-2 text-xs text-muted-foreground">
      <Link href="/admin/reading-lists" className="transition-colors hover:text-primary">فهرست‌های مطالعه</Link>
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      <span className="font-bold text-foreground">{initial ? "ویرایش فهرست" : "فهرست تازه"}</span>
    </nav>

    <header className="relative overflow-hidden rounded-[2rem] bg-[#102b23] px-6 py-8 text-white sm:px-9 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full border border-white/10 bg-[#245b47]/35 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-8 hidden h-40 w-52 rotate-[-14deg] rounded-t-xl border-x-[10px] border-t-[10px] border-[#d5c59b] bg-[#234c3f] shadow-[18px_0_0_#a9bd9a,36px_0_0_#d7b89c] lg:block" />
      <div className="relative max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#d9e9d7]"><Sparkles className="size-3.5" /> ابزار سردبیری قفسه</div>
        <h1 className="text-2xl font-black leading-relaxed sm:text-3xl">{initial ? "ویرایش فهرست مطالعه" : "یک مسیر تازه برای خواندن بساز"}</h1>
        <p className="mt-2 max-w-xl text-sm leading-7 text-white/65">فهرست را معرفی کن، کتاب‌ها را بچین و وقتی آماده بود، برای خوانندگان منتشرش کن.</p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-white/75">
          <span className="rounded-full border border-white/15 px-3 py-1.5">۱. معرفی</span>
          <span className="rounded-full border border-white/15 px-3 py-1.5">۲. انتخاب کتاب</span>
          <span className="rounded-full border border-white/15 px-3 py-1.5">۳. انتشار</span>
        </div>
      </div>
    </header>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <section className={cardClass} aria-labelledby="list-details">
          <div id="list-details"><SectionHeading number="۰۱" icon={FileText} title="معرفی فهرست" description="عنوان و توضیحی بنویس که به خواننده بگوید این فهرست برای چیست." /></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="عنوان فهرست" required hint="حداکثر ۳۰۰ نویسه"><input maxLength={300} className={inputClass} value={title} onChange={(event) => { const value = event.target.value; setTitle(value); if (!slugTouched) setSlug(slugify(value)); }} placeholder="مثلاً از کجا فلسفه را شروع کنیم؟" /></Field></div>
            <div className="sm:col-span-2"><Field label="زیرعنوان" hint="اختیاری · حداکثر ۳۰۰ نویسه"><input maxLength={300} className={inputClass} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="مثلاً یک شروع آرام برای آشنایی با فلسفهٔ اگزیستانسیالیسم" /></Field></div>
            <div className="sm:col-span-2"><Field label="توضیح کوتاه" required hint={`${description.length.toLocaleString("fa-IR")} / ۲۰۰۰`}><textarea maxLength={2000} className={`${inputClass} min-h-32 resize-y py-3 leading-7`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="در چند جمله، حال‌وهوای این فهرست و ارزش آن را توضیح بده..." /></Field></div>
            <div className="sm:col-span-2"><Field label="مناسب برای چه کسانی؟" hint="اختیاری"><textarea maxLength={1000} className={`${inputClass} min-h-24 resize-y py-3 leading-7`} value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="مثلاً برای کسانی که تازه به این موضوع علاقه‌مند شده‌اند" /></Field></div>
            <Field label="دسته‌بندی" required><input list="list-categories" maxLength={100} className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="مثلاً ادبیات کلاسیک" /><datalist id="list-categories"><option value="فانتزی" /><option value="ادبیات کلاسیک" /><option value="فلسفه" /><option value="زندگی و معنا" /></datalist></Field>
            <Field label="گروه نمایش" required><select className={inputClass} value={hubGroup} onChange={(event) => setHubGroup(event.target.value)}>{[...new Set([...groups, hubGroup])].map((group) => <option key={group} value={group}>{group}</option>)}</select></Field>
          </div>
        </section>

        <section className={cardClass} aria-labelledby="list-books">
          <div id="list-books"><SectionHeading number="۰۲" icon={Layers3} title="کتاب‌ها و ترتیب خواندن" description="نوع فهرست را انتخاب کن و کتاب‌های مناسب را از کاتالوگ اضافه کن." /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["ORDERED", "UNORDERED"] as const).map((value) => <label key={value} className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-primary ${mode === value ? "border-primary bg-primary/5" : "border-border-strong hover:bg-muted/50"}`}>
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border-strong"}`}>{mode === value && <Check className="size-3" />}</span>
              <span><strong className="block text-sm">{value === "ORDERED" ? "مسیر ترتیبی" : "مجموعه آزاد"}</strong><span className="mt-1 block text-xs leading-6 text-muted-foreground">{value === "ORDERED" ? "کتاب‌ها را به ترتیب پیشنهادی مطالعه می‌کنند." : "کتاب‌ها بدون ترتیب اجباری کنار هم قرار می‌گیرند."}</span></span>
            </label>)}
          </div>

          <div className="mt-7 border-t border-border pt-6">
            <div className="mb-3 flex items-center justify-between gap-2"><label htmlFor="book-search" className="text-sm font-black">جست‌وجو و افزودن کتاب</label><span className="text-xs text-muted-foreground">{items.length.toLocaleString("fa-IR")} کتاب انتخاب شده</span></div>
            <div className="relative"><Search aria-hidden="true" className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input id="book-search" type="search" className={`${inputClass} pr-11`} value={bookQuery} onChange={(event) => setBookQuery(event.target.value)} placeholder="نام کتاب یا نویسنده را بنویس..." /></div>
            {searching && <p role="status" className="mt-2 text-xs text-muted-foreground">در حال جست‌وجو...</p>}
            {bookQuery.trim().length >= 2 && !searching && !bookMatches.length && <p className="mt-2 text-xs text-muted-foreground">کتابی پیدا نشد.</p>}
            {!!bookMatches.length && <ul aria-label="نتایج جست‌وجوی کتاب" className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-lg">{bookMatches.map((book) => <li key={book.id}><button type="button" disabled={items.some((item) => item.id === book.id)} onClick={() => { setItems((current) => [...current, { ...book, note: "", difficulty: null }]); setBookQuery(""); setBookMatches([]); }} className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded bg-muted"><BookCoverImage src={book.coverImage} alt="" fill sizes="32px" className="object-cover" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{book.title}</strong><span className="block truncate text-xs text-muted-foreground">{book.author}</span></span><Plus aria-hidden="true" className="size-4 text-primary" /></button></li>)}</ul>}
          </div>

          {!items.length ? <div className="mt-6 flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-primary/[0.035] px-6 text-center"><div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="size-6" /></div><strong className="text-sm">هنوز کتابی انتخاب نشده</strong><p className="mt-1 text-xs leading-6 text-muted-foreground">از کادر جست‌وجو کتابی پیدا کن تا فهرستت شکل بگیرد.</p></div> : <ol className="mt-6 space-y-3">{items.map((item, index) => <li key={item.id} className="rounded-2xl border border-border-strong bg-background/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">{mode === "ORDERED" ? (index + 1).toLocaleString("fa-IR") : "•"}</span>
              <span className="relative block h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm"><BookCoverImage src={item.coverImage} alt="" fill sizes="48px" className="object-cover" /></span>
              <span className="min-w-32 flex-1"><strong className="block text-sm leading-6">{item.title}</strong><span className="text-xs text-muted-foreground">{item.author}</span></span>
              <div className="flex items-center rounded-xl border border-border bg-card p-0.5"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`انتقال ${item.title} به بالا`} className="rounded-lg p-2 hover:bg-muted disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-primary"><ChevronUp className="size-4" /></button><button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`انتقال ${item.title} به پایین`} className="rounded-lg p-2 hover:bg-muted disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-primary"><ChevronDown className="size-4" /></button><span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" /><button type="button" onClick={() => setItems((current) => current.filter((book) => book.id !== item.id))} aria-label={`حذف ${item.title} از لیست`} className="rounded-lg p-2 text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive"><Trash2 className="size-4" /></button></div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_150px]"><Field label={mode === "ORDERED" ? "چرا این مرحله؟" : "یادداشت این کتاب"}><textarea maxLength={1000} className={`${inputClass} min-h-20 resize-y py-2.5 leading-6`} value={item.note} onChange={(event) => setItems((current) => current.map((book) => book.id === item.id ? { ...book, note: event.target.value } : book))} placeholder="توضیح کوتاه برای خواننده..." /></Field>{mode === "ORDERED" && <Field label="سختی مطالعه"><select className={inputClass} value={item.difficulty ?? ""} onChange={(event) => setItems((current) => current.map((book) => book.id === item.id ? { ...book, difficulty: (event.target.value || null) as Item["difficulty"] } : book))}><option value="">نامشخص</option><option value="EASY">آسان</option><option value="MEDIUM">متوسط</option><option value="HARD">دشوار</option></select></Field>}</div>
          </li>)}</ol>}
        </section>

        <section className={cardClass} aria-labelledby="list-extra">
          <div id="list-extra"><SectionHeading number="۰۳" icon={Link2} title="ارتباط و نمایش در سایت" description="جایگاه فهرست را مشخص کن و مسیرهای مرتبط را به خواننده نشان بده." /></div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-strong bg-background/60 p-4"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="mt-1 size-4 accent-primary" /><span><strong className="flex items-center gap-2 text-sm"><Sparkles className="size-4 text-primary" /> نمایش ویژه در صفحه فهرست‌ها</strong><span className="mt-1 block text-xs leading-6 text-muted-foreground">این فهرست در میان پیشنهادهای برجسته نمایش داده شود.</span></span></label>
          <div className="mt-6"><h3 className="mb-3 text-sm font-black">فهرست‌های مرتبط</h3>{relatedOptions.length ? <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{relatedOptions.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm hover:bg-muted/40"><input type="checkbox" checked={relatedIds.includes(option.id)} onChange={(event) => setRelatedIds((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} className="mt-1 accent-primary" /><span>{option.title}{option.status === "DRAFT" && <span className="mr-1 text-xs text-muted-foreground">(پیش‌نویس)</span>}</span></label>)}</div> : <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">هنوز فهرست دیگری برای ارتباط وجود ندارد.</p>}</div>
        </section>

        <section className={cardClass} aria-labelledby="list-seo">
          <div id="list-seo"><SectionHeading number="۰۴" icon={Globe2} title="نشانی و نمایش در جست‌وجو" description="نشانی صفحه را تنظیم کن. عنوان و توضیح سئو در صورت خالی بودن از متن فهرست گرفته می‌شوند." /></div>
          <div className="space-y-5"><Field label="نشانی فهرست" required><div className="flex overflow-hidden rounded-2xl border border-border-strong bg-background/70 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"><span dir="ltr" className="flex shrink-0 items-center border-l border-border bg-muted/50 px-4 text-xs text-muted-foreground">/lists/</span><input dir="ltr" maxLength={300} className="min-h-12 min-w-0 flex-1 bg-transparent px-4 text-left text-sm outline-none" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} placeholder="my-reading-list" /></div></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="عنوان سئو" hint="اختیاری"><input maxLength={300} className={inputClass} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder={title || "عنوان فهرست"} /></Field><Field label="توضیح متا" hint="اختیاری"><textarea maxLength={1000} className={`${inputClass} min-h-24 resize-y py-3 leading-6`} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} placeholder="خلاصه‌ای برای نتیجه جست‌وجو..." /></Field></div></div>
        </section>
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20">
        <div className="overflow-hidden rounded-[1.7rem] border border-border bg-card shadow-[0_18px_55px_-45px_rgba(0,0,0,0.45)]">
          <div className="border-b border-border bg-muted/40 px-5 py-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-black">انتشار فهرست</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${initial?.status === "PUBLISHED" ? "bg-primary/10 text-primary" : "bg-accent-book/15 text-accent-book"}`}>{initial?.status === "PUBLISHED" ? "منتشر شده" : "پیش‌نویس"}</span></div></div>
          <div className="space-y-5 p-5">
            <div className="rounded-2xl border border-border bg-background/60 p-4"><span className="text-[11px] font-bold text-muted-foreground">نمای کلی</span><strong className="mt-2 block break-words text-base leading-7">{title.trim() || "عنوان فهرست شما"}</strong><p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">{description.trim() || "توضیحی که برای فهرست می‌نویسی اینجا دیده می‌شود."}</p><div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{items.length.toLocaleString("fa-IR")} کتاب</span><span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{mode === "ORDERED" ? "مسیر ترتیبی" : "مجموعه آزاد"}</span></div></div>
            <div className="space-y-2 text-xs"><div className="flex items-center justify-between"><span className="text-muted-foreground">اطلاعات اصلی</span><span className={title.trim() && description.trim() && category.trim() && slug.trim() ? "text-primary" : "text-accent-book"}>{title.trim() && description.trim() && category.trim() && slug.trim() ? "تکمیل شده" : "نیاز به تکمیل"}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">کتاب‌های فهرست</span><span className={items.length ? "text-primary" : "text-accent-book"}>{items.length ? `${items.length.toLocaleString("fa-IR")} کتاب` : "بدون کتاب"}</span></div></div>
            <p className="text-xs leading-6 text-muted-foreground">برای انتشار، اطلاعات اصلی و دست‌کم یک کتاب عمومی لازم است.</p>
            <div className="space-y-2"><button type="button" disabled={saving} onClick={() => void save("PUBLISHED")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60">{saving ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}{initial?.status === "PUBLISHED" ? "ذخیره و انتشار" : "انتشار فهرست"}</button><button type="button" disabled={saving} onClick={() => void save("DRAFT")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-background px-4 text-sm font-bold transition-colors hover:bg-muted disabled:opacity-60"><FileText className="size-4" />ذخیره پیش‌نویس</button></div>
            {initial?.status === "PUBLISHED" && <Link href={`/lists/${initial.slug}`} target="_blank" className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:underline"><Eye className="size-4" />مشاهده صفحه منتشرشده<ArrowLeft className="size-3.5" /></Link>}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-xs leading-6 text-muted-foreground"><div className="mb-1 flex items-center gap-2 font-bold text-primary"><BookOpen className="size-4" /> یادآوری سردبیری</div>یادداشت کوتاه کنار هر کتاب کمک می‌کند خواننده بداند چرا آن کتاب در فهرست قرار گرفته است.</div>
      </aside>
    </div>
  </div>;
}
