"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { REFERENCE_DESCRIPTION_LIMITS } from "@/lib/reference/limits";
import {
  AdminActionButton,
  AdminBadge,
  AdminColumn,
  AdminDataTable,
  AdminDataTableActions,
  AdminDataTableCell,
  AdminDataTableRow,
  AdminDataTableSearch,
  AdminDataTableToolbar,
} from "@/components/admin/AdminDataTable";
import { useConfirm } from "@/components/common/ConfirmDialog";
import {
  APPROVAL_STATUS_LABELS,
  REFERENCE_TYPE_LABELS,
  type ReferenceTypeValue,
} from "@/lib/validations/reference";

interface Item {
  id: string;
  name: string;
  roles: ReferenceTypeValue[];
  slug: string | null;
  coverImage: string | null;
  bannerImage: string | null;
  originalName: string | null;
  description: string | null;
  shortDescription: string | null;
  imageFilename: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  birthYear: number | null;
  deathYear: number | null;
  countryName: string | null;
  countrySlug: string | null;
  website: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const statusBadge: Record<string, string> = {
  APPROVED: "bg-primary/15 text-primary",
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  REJECTED: "bg-destructive/15 text-destructive",
};

const REF_COLUMNS: AdminColumn[] = [
  { key: "name", label: "نام" },
  { key: "roles", label: "نقش‌ها" },
  { key: "status", label: "وضعیت" },
  { key: "actions", label: "عملیات", align: "center" },
];

/**
 * Generic admin manager for one ReferenceItem type (categories/authors/…).
 * Wired to the shared /api/admin/reference endpoints.
 */
export default function ReferenceManager({
  type,
  itemLabel,
}: {
  type: ReferenceTypeValue;
  // عنوان/توضیح هنوز توسط صفحات پاس داده می‌شوند اما در نوار ابزار نمایش داده
  // نمی‌شوند (صفحات لیست مستقیم با کنترل‌ها شروع می‌شوند).
  title?: string;
  description?: string;
  itemLabel: string;
}) {
  const confirm = useConfirm();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    originalName: "",
    description: "",
    shortDescription: "",
    coverImage: "",
    bannerImage: "",
    imageFilename: "",
    sourceName: "",
    sourceUrl: "",
    seoTitle: "",
    seoDescription: "",
    birthYear: "",
    deathYear: "",
    countryName: "",
    countrySlug: "",
    website: "",
    status: "APPROVED" as Item["status"],
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/reference?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setItems(data.items || []);
      else toast.error(data.error || "خطا در بارگذاری");
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, [type, statusFilter, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ثبت ناموفق بود");
        return;
      }
      toast.success("ثبت شد");
      setNewName("");
      load();
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/reference/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("به‌روزرسانی شد");
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: status as Item["status"] } : i
        )
      );
    } else toast.error("عملیات ناموفق بود");
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({
      name: item.name,
      slug: item.slug ?? "",
      originalName: item.originalName ?? "",
      description: item.description ?? "",
      shortDescription: item.shortDescription ?? "",
      coverImage: item.coverImage ?? "",
      bannerImage: item.bannerImage ?? "",
      imageFilename: item.imageFilename ?? "",
      sourceName: item.sourceName ?? "",
      sourceUrl: item.sourceUrl ?? "",
      seoTitle: item.seoTitle ?? "",
      seoDescription: item.seoDescription ?? "",
      birthYear: item.birthYear?.toString() ?? "",
      deathYear: item.deathYear?.toString() ?? "",
      countryName: item.countryName ?? "",
      countrySlug: item.countrySlug ?? "",
      website: item.website ?? "",
      status: item.status,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/reference/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          originalName: form.originalName.trim() || null,
          description: form.description.trim() || null,
          shortDescription: form.shortDescription.trim() || null,
          coverImage: form.coverImage || null,
          bannerImage: form.bannerImage || null,
          imageFilename: form.imageFilename.trim() || null,
          sourceName: form.sourceName.trim() || null,
          sourceUrl: form.sourceUrl.trim() || null,
          seoTitle: form.seoTitle.trim() || null,
          seoDescription: form.seoDescription.trim() || null,
          birthYear: form.birthYear.trim() ? Number(form.birthYear) : null,
          deathYear: form.deathYear.trim() ? Number(form.deathYear) : null,
          countryName: form.countryName.trim() || null,
          countrySlug: form.countrySlug.trim() || null,
          website: form.website.trim() || null,
          status: form.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "ذخیره ناموفق بود");
        return;
      }
      toast.success("ذخیره شد");
      setEditing(null);
      load();
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = (id: string) => {
    void confirm({
      title: "حذف مورد",
      description: `این ${itemLabel} حذف شود؟ این عملیات قابل بازگشت نیست.`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/reference/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          toast.success("مورد حذف شد.");
          setItems((prev) => prev.filter((i) => i.id !== id));
        } else toast.error("حذف مورد ناموفق بود.");
      },
    });
  };

  return (
    <div>
      <AdminDataTableToolbar>
        <AdminDataTableSearch
          value={q}
          onChange={setQ}
          placeholder={`جست‌وجوی ${itemLabel}...`}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-full rounded-2xl sm:w-48">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه‌ی وضعیت‌ها</SelectItem>
            <SelectItem value="PENDING">در انتظار تأیید</SelectItem>
            <SelectItem value="APPROVED">تأییدشده</SelectItem>
            <SelectItem value="REJECTED">ردشده</SelectItem>
          </SelectContent>
        </Select>
      </AdminDataTableToolbar>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/55 p-4 backdrop-blur-md sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs text-muted-foreground">
            {`افزودن ${itemLabel}`}
          </label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`نام ${itemLabel} جدید`}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </div>
        <Button onClick={create} disabled={creating || !newName.trim()} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          افزودن
        </Button>
      </div>

      <AdminDataTable
        columns={REF_COLUMNS}
        loading={loading}
        isEmpty={items.length === 0}
        minWidth={460}
      >
        {items.map((item) => (
          <AdminDataTableRow key={item.id}>
            <AdminDataTableCell className="font-medium">
              {item.name}
            </AdminDataTableCell>
            <AdminDataTableCell className="text-xs text-muted-foreground">
              {item.roles.map((role) => REFERENCE_TYPE_LABELS[role]).join("، ")}
            </AdminDataTableCell>
            <AdminDataTableCell>
              <AdminBadge className={statusBadge[item.status]}>
                {APPROVAL_STATUS_LABELS[item.status]}
              </AdminBadge>
            </AdminDataTableCell>
            <AdminDataTableCell align="center">
              <AdminDataTableActions>
                <AdminActionButton
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => openEdit(item)}
                  title="ویرایش"
                />
                {item.status !== "APPROVED" ? (
                  <AdminActionButton
                    icon={<Check className="h-4 w-4" />}
                    tone="primary"
                    onClick={() => setStatus(item.id, "APPROVED")}
                    title="تأیید"
                  />
                ) : null}
                {item.status !== "REJECTED" ? (
                  <AdminActionButton
                    icon={<X className="h-4 w-4" />}
                    onClick={() => setStatus(item.id, "REJECTED")}
                    title="رد"
                  />
                ) : null}
                <AdminActionButton
                  icon={<Trash2 className="h-4 w-4" />}
                  tone="danger"
                  onClick={() => remove(item.id)}
                  title="حذف"
                />
              </AdminDataTableActions>
            </AdminDataTableCell>
          </AdminDataTableRow>
        ))}
      </AdminDataTable>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="pt-12">
            <SheetTitle>{`ویرایش ${itemLabel}`}</SheetTitle>
            <SheetDescription className="sr-only">
              ویرایش نام، اسلاگ، تصاویر و توضیحات صفحه‌ی عمومی.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="ref-name">نام</Label>
              <Input
                id="ref-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-slug">اسلاگ</Label>
              <Input
                id="ref-slug"
                dir="ltr"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="به‌صورت خودکار از نام ساخته می‌شود"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-original-name">نام اصلی</Label>
              <Input
                id="ref-original-name"
                dir="ltr"
                value={form.originalName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, originalName: e.target.value }))
                }
                placeholder="Albert Camus"
              />
            </div>

            <ImageUploader
              value={form.bannerImage}
              onChange={(url) => setForm((f) => ({ ...f, bannerImage: url }))}
              folder="references"
              variant="banner"
              label="بنر صفحه"
            />

            <ImageUploader
              value={form.coverImage}
              onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
              folder="references"
              variant="avatar"
              label="تصویر/لوگو"
            />

            <div className="space-y-1.5">
              <Label htmlFor="ref-image-filename">نام فایل تصویر</Label>
              <Input
                id="ref-image-filename"
                dir="ltr"
                value={form.imageFilename}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageFilename: e.target.value }))
                }
                placeholder="avatar.jpg یا logo.jpg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-desc">توضیحات</Label>
              <Textarea
                id="ref-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="min-h-28"
                maxLength={REFERENCE_DESCRIPTION_LIMITS.full}
                placeholder="بیوگرافی یا توضیح کامل..."
              />
              <p className="text-left text-xs tabular-nums text-muted-foreground">{form.description.length.toLocaleString("fa-IR")} / {REFERENCE_DESCRIPTION_LIMITS.full.toLocaleString("fa-IR")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-short-desc">توضیح کوتاه</Label>
              <Textarea
                id="ref-short-desc"
                value={form.shortDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, shortDescription: e.target.value }))
                }
                className="min-h-20"
                maxLength={REFERENCE_DESCRIPTION_LIMITS.short}
                placeholder="خلاصه‌ی کوتاه برای کارت‌ها و سئو"
              />
              <p className="text-left text-xs tabular-nums text-muted-foreground">{form.shortDescription.length.toLocaleString("fa-IR")} / {REFERENCE_DESCRIPTION_LIMITS.short.toLocaleString("fa-IR")}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ref-birth-year">سال تولد</Label>
                <Input
                  id="ref-birth-year"
                  dir="ltr"
                  value={form.birthYear}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, birthYear: e.target.value }))
                  }
                  placeholder="1913"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-death-year">سال وفات</Label>
                <Input
                  id="ref-death-year"
                  dir="ltr"
                  value={form.deathYear}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deathYear: e.target.value }))
                  }
                  placeholder="1960"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ref-country-name">کشور</Label>
                <Input
                  id="ref-country-name"
                  value={form.countryName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, countryName: e.target.value }))
                  }
                  placeholder="فرانسه"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-country-slug">اسلاگ کشور</Label>
                <Input
                  id="ref-country-slug"
                  dir="ltr"
                  value={form.countrySlug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, countrySlug: e.target.value }))
                  }
                  placeholder="france"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-website">وب‌سایت</Label>
              <Input
                id="ref-website"
                dir="ltr"
                value={form.website}
                onChange={(e) =>
                  setForm((f) => ({ ...f, website: e.target.value }))
                }
                placeholder="https://example.com"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ref-source-name">نام منبع</Label>
                <Input
                  id="ref-source-name"
                  value={form.sourceName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sourceName: e.target.value }))
                  }
                  placeholder="manual"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-source-url">لینک منبع</Label>
                <Input
                  id="ref-source-url"
                  dir="ltr"
                  value={form.sourceUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sourceUrl: e.target.value }))
                  }
                  placeholder="https://example.com/source"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-seo-title">عنوان SEO</Label>
              <Input
                id="ref-seo-title"
                value={form.seoTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seoTitle: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-seo-description">توضیح SEO</Label>
              <Textarea
                id="ref-seo-description"
                value={form.seoDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seoDescription: e.target.value }))
                }
                className="min-h-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-status">وضعیت</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as Item["status"] }))
                }
              >
                <SelectTrigger id="ref-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">تأییدشده</SelectItem>
                  <SelectItem value="PENDING">در انتظار تأیید</SelectItem>
                  <SelectItem value="REJECTED">ردشده</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={saveEdit}
              disabled={savingEdit || !form.name.trim()}
              className="w-full gap-2"
            >
              {savingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              ذخیره
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
