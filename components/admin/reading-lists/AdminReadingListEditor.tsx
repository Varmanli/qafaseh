"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminFormField from "@/components/admin/AdminFormField";
import AdminFormSection from "@/components/admin/AdminFormSection";
import BookCoverImage from "@/components/books/BookCoverImage";
import { slugify } from "@/lib/book/slug";
import type { getAdminReadingList, getAdminRelatedOptions } from "@/lib/admin/reading-lists";

type Existing = NonNullable<Awaited<ReturnType<typeof getAdminReadingList>>>;
type Option = Awaited<ReturnType<typeof getAdminRelatedOptions>>[number];
type Book = { id: string; title: string; author: string; coverImage: string | null };
type Item = Book & { note: string; difficulty: "EASY" | "MEDIUM" | "HARD" | null };

const field = "w-full min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";
const groups = ["جهان‌های خیال", "مسیرهای موضوعی", "ادبیات جهان", "نویسندگان", "فلسفه و اندیشه", "ژانرها", "پیشنهادهای قفسه"];

export default function AdminReadingListEditor({ initial, relatedOptions }: { initial?: Existing; relatedOptions: Option[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
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
        title: title.trim(), slug: slug.trim(), description: description.trim(),
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

  return <div className="space-y-6" dir="rtl">
    <Link href="/admin/reading-lists" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-primary"><ArrowRight className="size-4" /> بازگشت به لیست‌ها</Link>
    <AdminPageHeader title={initial ? "ویرایش لیست" : "ساخت لیست"} description="کتاب‌ها را انتخاب و با ترتیب دلخواه ذخیره کن." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <AdminFormSection title="اطلاعات لیست"><div className="grid gap-4 sm:grid-cols-2">
          <AdminFormField label="عنوان" required><input className={field} value={title} onChange={(event) => { const value = event.target.value; setTitle(value); if (!slugTouched) setSlug(slugify(value)); }} /></AdminFormField>
          <AdminFormField label="اسلاگ" required><input dir="ltr" className={field} value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} /></AdminFormField>
          <div className="sm:col-span-2"><AdminFormField label="توضیح" required><textarea className={`${field} min-h-28 py-3`} value={description} onChange={(event) => setDescription(event.target.value)} /></AdminFormField></div>
          <div className="sm:col-span-2"><AdminFormField label="مناسب برای"><textarea className={`${field} min-h-20 py-3`} value={audience} onChange={(event) => setAudience(event.target.value)} /></AdminFormField></div>
          <AdminFormField label="دسته‌بندی" required><input list="list-categories" className={field} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="مثلاً ادبیات کلاسیک" /><datalist id="list-categories"><option value="فانتزی" /><option value="ادبیات کلاسیک" /><option value="فلسفه" /><option value="زندگی و معنا" /></datalist></AdminFormField>
          <AdminFormField label="گروه نمایش" required><select className={field} value={hubGroup} onChange={(event) => setHubGroup(event.target.value)}>{[...new Set([...groups, hubGroup])].map((group) => <option key={group} value={group}>{group}</option>)}</select></AdminFormField>
        </div></AdminFormSection>

        <AdminFormSection title="نوع لیست"><div className="grid gap-3 sm:grid-cols-2">
          {(["ORDERED", "UNORDERED"] as const).map((value) => <label key={value} className={`cursor-pointer rounded-xl border p-4 ${mode === value ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} className="ml-2" /><span className="font-bold">{value === "ORDERED" ? "مسیر ترتیبی" : "لیست معمولی"}</span><span className="mt-2 block text-xs leading-6 text-muted-foreground">{value === "ORDERED" ? "کتاب‌ها با ترتیب مشخص خوانده می‌شوند." : "مجموعه‌ای از کتاب‌ها بدون ترتیب پیشنهادی مطالعه."}</span></label>)}
        </div></AdminFormSection>

        <AdminFormSection title={mode === "ORDERED" ? "کتاب‌های مسیر" : "کتاب‌های مجموعه"}><div className="space-y-4">
          <label className="block text-sm font-bold" htmlFor="book-search">افزودن کتاب</label>
          <input id="book-search" type="search" className={field} value={bookQuery} onChange={(event) => setBookQuery(event.target.value)} placeholder="نام کتاب یا نویسنده را جست‌وجو کن..." />
          {searching && <p role="status" className="text-xs text-muted-foreground">در حال جست‌وجو...</p>}
          {bookQuery.trim().length >= 2 && !searching && !bookMatches.length && <p className="text-xs text-muted-foreground">کتابی پیدا نشد.</p>}
          {!!bookMatches.length && <ul aria-label="نتایج جست‌وجوی کتاب" className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border p-2">{bookMatches.map((book) => <li key={book.id}><button type="button" disabled={items.some((item) => item.id === book.id)} onClick={() => { setItems((current) => [...current, { ...book, note: "", difficulty: null }]); setBookQuery(""); setBookMatches([]); }} className="flex w-full items-center gap-3 rounded-lg p-2 text-right hover:bg-muted disabled:opacity-50"><span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded bg-muted"><BookCoverImage src={book.coverImage} alt="" fill sizes="32px" className="object-cover" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{book.title}</span><span className="block truncate text-xs text-muted-foreground">{book.author}</span></span><Plus aria-hidden="true" className="size-4" /></button></li>)}</ul>}
          {!items.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">هنوز کتابی به این لیست اضافه نشده. از جست‌وجوی بالا کتابی اضافه کن.</p>}
          <ol className="space-y-3">{items.map((item, index) => <li key={item.id} className="rounded-xl border border-border bg-background p-3">
            <div className="flex flex-wrap items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-xs font-black text-primary">{mode === "ORDERED" ? String(index + 1).padStart(2, "0") : "•"}</span><span className="relative block h-16 w-11 shrink-0 overflow-hidden rounded bg-muted"><BookCoverImage src={item.coverImage} alt="" fill sizes="44px" className="object-cover" /></span><span className="min-w-32 flex-1"><strong className="block text-sm">{item.title}</strong><span className="text-xs text-muted-foreground">{item.author}</span></span>
              <div className="flex items-center gap-1"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`انتقال ${item.title} به بالا`} className="rounded-lg p-2 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary"><ChevronUp className="size-4" /></button><button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`انتقال ${item.title} به پایین`} className="rounded-lg p-2 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary"><ChevronDown className="size-4" /></button><button type="button" onClick={() => setItems((current) => current.filter((book) => book.id !== item.id))} aria-label={`حذف ${item.title} از لیست`} className="rounded-lg p-2 text-destructive focus-visible:ring-2 focus-visible:ring-destructive"><Trash2 className="size-4" /></button></div>
            </div><div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]"><label className="text-xs font-bold">{mode === "ORDERED" ? "چرا این مرحله؟" : "توضیح این کتاب در لیست"}<textarea className={`${field} mt-1 min-h-20 py-2`} value={item.note} onChange={(event) => setItems((current) => current.map((book) => book.id === item.id ? { ...book, note: event.target.value } : book))} /></label>{mode === "ORDERED" && <label className="text-xs font-bold">سختی مطالعه<select className={`${field} mt-1`} value={item.difficulty ?? ""} onChange={(event) => setItems((current) => current.map((book) => book.id === item.id ? { ...book, difficulty: (event.target.value || null) as Item["difficulty"] } : book))}><option value="">نامشخص</option><option value="EASY">آسان</option><option value="MEDIUM">متوسط</option><option value="HARD">دشوار</option></select></label>}</div>
          </li>)}</ol>
          {!!items.length && <p className="text-xs text-muted-foreground">{mode === "ORDERED" ? "ترتیب مطالعه" : "ترتیب نمایش"} با دکمه‌های بالا و پایین تغییر می‌کند.</p>}
        </div></AdminFormSection>
      </div>

      <div className="space-y-6">
        <AdminFormSection title="انتشار"><div className="space-y-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /> ویژه در صفحه لیست‌ها</label><p className="text-xs leading-6 text-muted-foreground">لیست تازه به‌صورت پیش‌نویس ذخیره می‌شود. انتشار به حداقل یک کتاب عمومی نیاز دارد.</p><button type="button" disabled={saving} onClick={() => void save("DRAFT")} className="min-h-11 w-full rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-50">ذخیره پیش‌نویس</button><button type="button" disabled={saving} onClick={() => void save("PUBLISHED")} className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{initial?.status === "PUBLISHED" ? "ذخیره و انتشار" : "انتشار لیست"}</button>{initial?.status === "PUBLISHED" && <Link href={`/lists/${initial.slug}`} target="_blank" className="block text-center text-sm font-bold text-primary">مشاهده صفحه</Link>}</div></AdminFormSection>
        <AdminFormSection title="لیست‌های مرتبط"><div className="max-h-60 space-y-2 overflow-y-auto">{relatedOptions.map((option) => <label key={option.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={relatedIds.includes(option.id)} onChange={(event) => setRelatedIds((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} /><span>{option.title}<span className="mr-1 text-xs text-muted-foreground">{option.status === "DRAFT" ? "(پیش‌نویس)" : ""}</span></span></label>)}{!relatedOptions.length && <p className="text-xs text-muted-foreground">لیست دیگری وجود ندارد.</p>}</div></AdminFormSection>
        <AdminFormSection title="سئو"><div className="space-y-3"><AdminFormField label="عنوان سئو"><input className={field} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} /></AdminFormField><AdminFormField label="توضیح متا"><textarea className={`${field} min-h-24 py-3`} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></AdminFormField><p className="text-xs text-muted-foreground">اگر خالی باشند، عنوان و توضیح لیست استفاده می‌شود.</p></div></AdminFormSection>
      </div>
    </div>
  </div>;
}
