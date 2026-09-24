"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useConfirm } from "@/components/common/ConfirmDialog";

type Row = {
  id: string; title: string; slug: string; mode: "ORDERED" | "UNORDERED";
  category: string; hubGroup: string; status: "DRAFT" | "PUBLISHED";
  featured: boolean; bookCount: number; updatedAt: string;
};

const control = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AdminReadingListsIndex() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (mode) params.set("mode", mode);
      if (status) params.set("status", status);
      if (category) params.set("category", category);
      const response = await fetch(`/api/admin/reading-lists?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "بارگذاری لیست‌ها ناموفق بود");
      setRows(data.lists);
      if (!mode && !status && !category && !q) setCategories([...new Set((data.lists as Row[]).map((row) => row.hubGroup))]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "خطای ارتباط با سرور"); }
    finally { setLoading(false); }
  }, [q, mode, status, category]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 220); return () => clearTimeout(timer); }, [load]);

  async function setPublication(row: Row) {
    setBusy(row.id);
    try {
      const response = await fetch(`/api/admin/reading-lists/${row.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: row.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تغییر وضعیت ناموفق بود");
      toast.success(data.message);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "خطای ارتباط با سرور"); }
    finally { setBusy(null); }
  }

  function remove(row: Row) {
    void confirm({ title: "حذف لیست", description: `«${row.title}» و ارتباط‌های آن حذف شود؟`, onConfirm: async () => {
      setBusy(row.id);
      try {
        const response = await fetch(`/api/admin/reading-lists/${row.id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "حذف ناموفق بود");
        toast.success(data.message);
        await load();
      } catch (error) { toast.error(error instanceof Error ? error.message : "خطای ارتباط با سرور"); }
      finally { setBusy(null); }
    } });
  }

  return <div className="space-y-6" dir="rtl">
    <AdminPageHeader title="لیست‌های مطالعه" description="مسیرهای ترتیبی و مجموعه‌های کتاب را مدیریت کن." />
    <div className="flex flex-wrap gap-2">
      <input aria-label="جست‌وجوی عنوان لیست" value={q} onChange={(event) => setQ(event.target.value)} placeholder="جست‌وجوی عنوان..." className={`${control} min-w-48 flex-1`} />
      <select aria-label="نوع لیست" value={mode} onChange={(event) => setMode(event.target.value)} className={control}><option value="">همه نوع‌ها</option><option value="ORDERED">مسیر ترتیبی</option><option value="UNORDERED">لیست معمولی</option></select>
      <select aria-label="وضعیت انتشار" value={status} onChange={(event) => setStatus(event.target.value)} className={control}><option value="">همه وضعیت‌ها</option><option value="DRAFT">پیش‌نویس</option><option value="PUBLISHED">منتشرشده</option></select>
      <select aria-label="گروه" value={category} onChange={(event) => setCategory(event.target.value)} className={control}><option value="">همه گروه‌ها</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select>
      <Link href="/admin/reading-lists/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><Plus className="size-4" /> ساخت لیست</Link>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[760px] text-right text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3">عنوان</th><th className="p-3">نوع</th><th className="p-3">دسته‌بندی</th><th className="p-3">کتاب</th><th className="p-3">وضعیت</th><th className="p-3">ویژه</th><th className="p-3">به‌روزرسانی</th><th className="p-3">عملیات</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border/50 last:border-0">
          <td className="p-3 font-bold">{row.title}<span dir="ltr" className="mt-1 block text-xs font-normal text-muted-foreground">/lists/{row.slug}</span></td>
          <td className="p-3">{row.mode === "ORDERED" ? "مسیر ترتیبی" : "لیست معمولی"}</td>
          <td className="p-3">{row.hubGroup}<span className="block text-xs text-muted-foreground">{row.category}</span></td>
          <td className="p-3">{row.bookCount.toLocaleString("fa-IR")}</td>
          <td className="p-3">{row.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}</td>
          <td className="p-3">{row.featured ? "بله" : "—"}</td>
          <td className="p-3 text-xs">{new Date(row.updatedAt).toLocaleDateString("fa-IR")}</td>
          <td className="p-3"><div className="flex items-center gap-2">
            <Link href={`/admin/reading-lists/${row.id}`} aria-label={`ویرایش ${row.title}`} className="rounded-lg p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"><Pencil className="size-4" /></Link>
            {row.status === "PUBLISHED" && <Link href={`/lists/${row.slug}`} target="_blank" aria-label={`مشاهده صفحه ${row.title}`} className="rounded-lg p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"><Eye className="size-4" /></Link>}
            <button type="button" disabled={busy === row.id} onClick={() => void setPublication(row)} className="min-h-9 rounded-lg border border-border px-2 text-xs font-bold disabled:opacity-50">{row.status === "PUBLISHED" ? "عدم انتشار" : "انتشار"}</button>
            <button type="button" disabled={busy === row.id} onClick={() => remove(row)} aria-label={`حذف ${row.title}`} className="rounded-lg p-2 text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive"><Trash2 className="size-4" /></button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {loading && <p className="p-5 text-sm text-muted-foreground">در حال بارگذاری...</p>}
      {!loading && !rows.length && <p className="p-5 text-sm text-muted-foreground">لیستی پیدا نشد. از «ساخت لیست» شروع کن.</p>}
    </div>
  </div>;
}
