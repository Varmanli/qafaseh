"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Link2, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_FOOTER_MENU, DEFAULT_HEADER_MENU, type NavLinkItem, type SiteNavigationMenus } from "@/lib/layout/navigation";

type MenuKey = keyof SiteNavigationMenus;

async function readResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : null;
  if (!response.ok) throw new Error(message || `درخواست ناموفق بود (کد ${response.status})`);
  if (!payload || typeof payload !== "object") throw new Error("پاسخ سرور معتبر نیست");
  return payload as T;
}

const DEFAULT_MENUS: SiteNavigationMenus = {
  header: DEFAULT_HEADER_MENU,
  footer: DEFAULT_FOOTER_MENU,
};

export default function SiteNavigationManager() {
  const [menus, setMenus] = useState<SiteNavigationMenus>(DEFAULT_MENUS);
  const [saved, setSaved] = useState<SiteNavigationMenus>(DEFAULT_MENUS);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("header");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/navigation", { cache: "no-store" })
      .then((response) => readResponse<{ menus: SiteNavigationMenus }>(response))
      .then(({ menus: initial }) => {
        if (!active) return;
        setMenus(initial);
        setSaved(initial);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "بارگذاری منوها ناموفق بود"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const items = menus[activeMenu];
  const isDirty = useMemo(() => JSON.stringify(menus) !== JSON.stringify(saved), [menus, saved]);
  const maxItems = activeMenu === "header" ? 5 : 15;

  function updateItem(index: number, key: keyof NavLinkItem, value: string) {
    setMenus((current) => ({
      ...current,
      [activeMenu]: current[activeMenu].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    setMenus((current) => ({ ...current, [activeMenu]: reordered }));
  }

  function addItem() {
    if (items.length >= maxItems) return;
    setMenus((current) => ({ ...current, [activeMenu]: [...current[activeMenu], { label: "", href: "" }] }));
  }

  function removeItem(index: number) {
    setMenus((current) => ({ ...current, [activeMenu]: current[activeMenu].filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(menus),
      });
      const data = await readResponse<{ menus: SiteNavigationMenus; message?: string }>(response);
      setMenus(data.menus);
      setSaved(data.menus);
      toast.success(data.message || "منوها ذخیره شدند");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره منوها ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  return <div dir="rtl" className="space-y-6">
    <AdminPageHeader
      title="منوهای هدر و فوتر"
      description="عنوان، آدرس و ترتیب لینک‌های ناوبری سایت را مدیریت کن."
      action={<Button onClick={() => void save()} disabled={loading || saving || !isDirty} className="h-11 gap-2 rounded-xl"><Save className="size-4" /> {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button>}
    />

    <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1" aria-label="انتخاب منو">
      {(["header", "footer"] as const).map((key) => (
        <button key={key} type="button" aria-pressed={activeMenu === key} onClick={() => setActiveMenu(key)} className={`min-h-10 rounded-lg px-4 text-sm font-bold transition-colors ${activeMenu === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {key === "header" ? "منوی هدر" : "منوی فوتر"}
        </button>
      ))}
    </div>

    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black">{activeMenu === "header" ? "پیوندهای هدر و ناوبری موبایل" : "پیوندهای فوتر"}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {activeMenu === "header" ? "ترتیب لینک‌ها در هدر و نوار ناوبری موبایل یکسان است؛ حداکثر ۵ لینک." : "لینک‌های بخش دسترسی سریع پایین سایت؛ حداکثر ۱۵ لینک."}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addItem} disabled={loading || items.length >= maxItems} className="h-10 gap-2 rounded-xl"><Plus className="size-4" /> افزودن لینک</Button>
      </div>

      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری منوها...</p> : items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${activeMenu}-${index}`} className="grid gap-3 rounded-xl border border-border/70 bg-background/50 p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-center">
              <div className="flex items-center gap-1 sm:flex-col">
                <Button type="button" variant="ghost" size="icon" aria-label="انتقال لینک به بالا" disabled={index === 0} onClick={() => moveItem(index, -1)} className="size-8"><ArrowUp className="size-4" /></Button>
                <span className="min-w-6 text-center text-xs font-bold tabular-nums text-muted-foreground">{(index + 1).toLocaleString("fa-IR")}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="انتقال لینک به پایین" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} className="size-8"><ArrowDown className="size-4" /></Button>
              </div>
              <Input aria-label="عنوان لینک" maxLength={50} value={item.label} onChange={(event) => updateItem(index, "label", event.target.value)} placeholder="عنوان لینک" />
              <div className="relative">
                <Link2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="آدرس لینک" maxLength={500} value={item.href} onChange={(event) => updateItem(index, "href", event.target.value)} placeholder="/books یا https://example.com" className="pr-9" dir="ltr" />
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="حذف لینک" onClick={() => removeItem(index)} className="text-destructive"><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      ) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">این منو لینکی ندارد. برای شروع یک لینک اضافه کن.</p>}
    </section>
  </div>;
}
