"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AdminActionButton,
  AdminColumn,
  AdminDataTable,
  AdminDataTableActions,
  AdminDataTableCell,
  AdminDataTableRow,
  AdminDataTableSearch,
  AdminDataTableToolbar,
} from "@/components/admin/AdminDataTable";
import { useConfirm } from "@/components/common/ConfirmDialog";
import type { AdminBlogCategoryRow } from "@/lib/blog/service";
import BlogCategoryCoverField from "@/components/admin/blog/BlogCategoryCoverField";

const COLUMNS: AdminColumn[] = [
  { key: "name", label: "نام" },
  { key: "slug", label: "اسلاگ" },
  { key: "posts", label: "تعداد نوشته" },
  { key: "updated", label: "به‌روزرسانی" },
  { key: "actions", label: "عملیات", align: "center" },
];

export default function BlogCategoriesManager() {
  const confirm = useConfirm();
  const [items, setItems] = useState<AdminBlogCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog/categories", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) setItems(data.categories ?? []);
      else toast.error(data.error || "خطا در بارگذاری");
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term),
    );
  }, [items, q]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setCoverImage(null);
    setOpen(true);
  };

  const openEdit = (c: AdminBlogCategoryRow) => {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description ?? "");
    setCoverImage(c.coverImage);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("نام دسته‌بندی الزامی است");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/blog/categories/${editingId}`
        : "/api/admin/blog/categories";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          coverImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ذخیره ناموفق بود");
        return;
      }
      toast.success("ذخیره شد");
      setOpen(false);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const remove = (c: AdminBlogCategoryRow) => {
    void confirm({
      title: "حذف دسته‌بندی",
      description: `دسته‌بندی «${c.name}» حذف شود؟`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/blog/categories/${c.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // پیام مسدودی حذف (مثلاً وجود نوشته‌های متصل) به‌صورت واضح نمایش داده می‌شود.
          toast.error(data.error || "حذف ناموفق بود");
          return;
        }
        toast.success("دسته‌بندی حذف شد");
        setItems((prev) => prev.filter((x) => x.id !== c.id));
      },
    });
  };

  return (
    <div>
      <AdminDataTableToolbar>
        <AdminDataTableSearch
          value={q}
          onChange={setQ}
          placeholder="جست‌وجوی دسته‌بندی..."
        />
        <Button onClick={openCreate} className="h-11 gap-2 rounded-2xl sm:px-5">
          <Plus className="h-4 w-4" />
          دسته‌بندی جدید
        </Button>
      </AdminDataTableToolbar>

      <AdminDataTable
        columns={COLUMNS}
        loading={loading}
        isEmpty={filtered.length === 0}
        emptyText="هنوز دسته‌بندی‌ای ساخته نشده است."
        minWidth={640}
      >
        {filtered.map((c) => (
          <AdminDataTableRow key={c.id}>
            <AdminDataTableCell className="font-medium">
              {c.name}
            </AdminDataTableCell>
            <AdminDataTableCell className="text-muted-foreground">
              <span dir="ltr" className="block">
                {c.slug}
              </span>
            </AdminDataTableCell>
            <AdminDataTableCell className="tabular-nums text-muted-foreground">
              {c.postCount.toLocaleString("fa-IR")}
            </AdminDataTableCell>
            <AdminDataTableCell className="text-xs tabular-nums text-muted-foreground">
              {new Date(c.updatedAt).toLocaleDateString("fa-IR")}
            </AdminDataTableCell>
            <AdminDataTableCell align="center">
              <AdminDataTableActions>
                <AdminActionButton
                  icon={<ExternalLink className="h-4 w-4" />}
                  href={`/blog/category/${encodeURIComponent(c.slug)}`}
                  external
                  title="صفحه عمومی دسته"
                />
                <AdminActionButton
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => openEdit(c)}
                  title="ویرایش"
                />
                <AdminActionButton
                  icon={<Trash2 className="h-4 w-4" />}
                  tone="danger"
                  onClick={() => remove(c)}
                  title="حذف"
                />
              </AdminDataTableActions>
            </AdminDataTableCell>
          </AdminDataTableRow>
        ))}
      </AdminDataTable>

      <Sheet open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pt-12">
            <SheetTitle>
              {editingId ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              نام و توضیح دسته‌بندی مجله. اسلاگ به‌صورت خودکار ساخته می‌شود.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">نام *</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">توضیحات</Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24"
                placeholder="توضیح کوتاه (اختیاری)"
              />
            </div>
            <BlogCategoryCoverField value={coverImage} name={name} slug={items.find((item) => item.id === editingId)?.slug}
              onChange={setCoverImage} onUploadStateChange={setUploading} disabled={saving} />
          </div>

          <SheetFooter>
            <Button
              onClick={save}
              disabled={saving || uploading || !name.trim()}
              className="w-full gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ذخیره
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
