"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Term = { id: string; name: string; listCount: number; updatedAt: string };
type Resource = "categories" | "groups";

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  const apiError = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : null;
  if (!response.ok) throw new Error(apiError || `درخواست ناموفق بود (کد ${response.status})`);
  if (!payload || typeof payload !== "object") throw new Error("پاسخ سرور خالی یا نامعتبر است؛ دوباره تلاش کن.");
  return payload as T;
}

export default function ReadingListTermsManager({
  endpoint,
  resource,
  title,
  description,
  singular,
}: {
  endpoint: string;
  resource: Resource;
  title: string;
  description: string;
  singular: string;
}) {
  const confirm = useConfirm();
  const [items, setItems] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await readApiResponse<{ categories?: Term[]; groups?: Term[] }>(response);
      setItems(data[resource] ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری اطلاعات ناموفق بود");
    } finally {
      setLoading(false);
    }
  }, [endpoint, resource, singular]);

  useEffect(() => { void load(); }, [load]);

  function startCreate() {
    setEditing(null);
    setName("");
    setOpen(true);
  }

  function startEdit(item: Term) {
    setEditing(item);
    setName(item.name);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) return toast.error(`نام ${singular} الزامی است`);
    setSaving(true);
    try {
      const response = await fetch(editing ? `${endpoint}/${editing.id}` : endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await readApiResponse<{ message?: string }>(response);
      toast.success(data.message || "ذخیره شد");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد");
    } finally {
      setSaving(false);
    }
  }

  function remove(item: Term) {
    void confirm({
      title: `حذف ${singular}`,
      description: item.listCount
        ? `این ${singular} به ${item.listCount.toLocaleString("fa-IR")} فهرست متصل است و تا زمان تغییر ${singular} آن فهرست‌ها حذف نمی‌شود.`
        : `${singular} «${item.name}» حذف شود؟`,
      onConfirm: async () => {
        try {
          const response = await fetch(`${endpoint}/${item.id}`, { method: "DELETE" });
          const data = await readApiResponse<{ message?: string }>(response);
          toast.success(data.message || `${singular} حذف شد`);
          setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `حذف ${singular} ناموفق بود`);
        }
      },
    });
  }

  return <div dir="rtl" className="space-y-5">
    <AdminPageHeader
      title={title}
      description={description}
      action={<Button onClick={startCreate} className="h-11 gap-2 rounded-xl"><Plus className="size-4" /> {singular} جدید</Button>}
    />

    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-bold text-muted-foreground">
        <span>نام</span><span>فهرست‌های متصل</span><span>عملیات</span>
      </div>
      {loading ? <p className="p-5 text-sm text-muted-foreground">در حال بارگذاری...</p> : items.length ? items.map((item) => (
        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0">
          <span className="flex min-w-0 items-center gap-2 font-bold"><Tags className="size-4 shrink-0 text-primary" /> <span className="truncate">{item.name}</span></span>
          <span className="text-sm tabular-nums text-muted-foreground">{item.listCount.toLocaleString("fa-IR")}</span>
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label={`ویرایش ${item.name}`} onClick={() => startEdit(item)}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`حذف ${item.name}`} onClick={() => remove(item)}><Trash2 className="size-4 text-destructive" /></Button>
          </span>
        </div>
      )) : <p className="p-5 text-sm text-muted-foreground">هنوز موردی ثبت نشده است. یک مورد تازه بساز.</p>}
    </div>

    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex flex-col gap-0 sm:max-w-md">
        <SheetHeader className="text-right">
          <SheetTitle>{editing ? `ویرایش ${singular}` : `${singular} تازه`}</SheetTitle>
          <SheetDescription>{editing ? `تغییر نام روی تمام فهرست‌های مرتبط هم اعمال می‌شود.` : "نام مورد جدید را وارد کن."}</SheetDescription>
        </SheetHeader>
        <div className="px-4 py-6"><label htmlFor="reading-list-term-name" className="mb-2 block text-sm font-bold">نام</label><Input id="reading-list-term-name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <SheetFooter className="mt-auto">
          <Button onClick={() => void save()} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>;
}
