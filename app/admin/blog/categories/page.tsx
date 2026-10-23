"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, PenSquare, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

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
import AdminFormField from "@/components/admin/AdminFormField";
import AdminFormSection from "@/components/admin/AdminFormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/common/ConfirmDialog";
import BlogCategoryCoverField from "@/components/admin/blog/BlogCategoryCoverField";
import BlogCategoryCover from "@/components/blog/BlogCategoryCover";

interface BlogCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

const COLUMNS: AdminColumn[] = [
  { key: "name", label: "دسته‌بندی" },
  { key: "slug", label: "اسلاگ" },
  { key: "count", label: "تعداد نوشته" },
  { key: "updatedAt", label: "به‌روزرسانی" },
  { key: "actions", label: "عملیات", align: "center" },
];

export default function AdminBlogCategoriesPage() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<BlogCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BlogCategoryRow | null>(null);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.name, row.slug, row.description ?? ""].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [q, rows]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/blog/categories", {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "بارگذاری دسته‌بندی‌ها ناموفق بود.");
        return;
      }
      setRows(data.categories ?? []);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    if (uploading || saving) return;
    setEditing(null);
    setName("");
    setDescription("");
    setCoverImage(null);
  };

  const save = async () => {
    if (uploading) return;
    if (!name.trim()) {
      toast.error("نام دسته‌بندی الزامی است.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        editing
          ? `/api/admin/blog/categories/${editing.id}`
          : "/api/admin/blog/categories",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            coverImage,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "ذخیره دسته‌بندی ناموفق بود.");
        return;
      }

      toast.success(data.message || "ذخیره شد.");
      setEditing(null);
      setName("");
      setDescription("");
      setCoverImage(null);
      await load();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: BlogCategoryRow) => {
    void confirm({
      title: "حذف دسته‌بندی",
      description: `دسته‌بندی «${row.name}» حذف شود؟`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/blog/categories/${row.id}`, {
            method: "DELETE",
            credentials: "include",
          });
          const data = await response.json();
          if (!response.ok) {
            toast.error(data.error || "حذف دسته‌بندی ناموفق بود.");
            return;
          }
          toast.success(data.message || "دسته‌بندی حذف شد.");
          if (editing?.id === row.id) resetForm();
          await load();
        } catch {
          toast.error("ارتباط با سرور برقرار نشد.");
        }
      },
    });
  };

  const startEdit = (row: BlogCategoryRow) => {
    if (uploading || saving) return;
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
    setCoverImage(row.coverImage);
  };

  return (
    <div className="space-y-6">
      <AdminDataTableToolbar>
        <AdminDataTableSearch
          value={q}
          onChange={setQ}
          placeholder="جست‌وجو در دسته‌بندی‌های مجله..."
        />
        <Button
          type="button"
          onClick={resetForm}
          disabled={uploading || saving}
          className="h-11 w-full gap-2 rounded-2xl sm:w-auto sm:px-5"
        >
          <Plus className="h-4 w-4" />
          افزودن دسته‌بندی
        </Button>
      </AdminDataTableToolbar>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AdminDataTable
          columns={COLUMNS}
          loading={loading}
          isEmpty={filteredRows.length === 0}
        >
          {filteredRows.map((row) => (
            <AdminDataTableRow key={row.id}>
              <AdminDataTableCell align="start">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg"><BlogCategoryCover src={row.coverImage} slug={row.slug} sizes="80px" /></div>
                  <div className="space-y-1">
                  <p className="font-bold text-foreground">{row.name}</p>
                  {row.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                  </div>
                </div>
              </AdminDataTableCell>
              <AdminDataTableCell className="text-xs text-muted-foreground" align="start">
                <span dir="ltr">{row.slug}</span>
              </AdminDataTableCell>
              <AdminDataTableCell className="text-xs text-muted-foreground">
                {row.postCount.toLocaleString("fa-IR")}
              </AdminDataTableCell>
              <AdminDataTableCell className="text-xs text-muted-foreground">
                {new Date(row.updatedAt).toLocaleDateString("fa-IR")}
              </AdminDataTableCell>
              <AdminDataTableCell align="center">
                <AdminDataTableActions>
                  <AdminActionButton icon={<ExternalLink className="h-4 w-4" />} href={`/blog/category/${encodeURIComponent(row.slug)}`} external title="مشاهده صفحه دسته‌بندی" />
                  <AdminActionButton
                    icon={<PenSquare className="h-4 w-4" />}
                    title="ویرایش"
                    onClick={() => startEdit(row)}
                  />
                  <AdminActionButton
                    icon={<Trash2 className="h-4 w-4" />}
                    tone="danger"
                    title="حذف"
                    onClick={() => remove(row)}
                  />
                </AdminDataTableActions>
              </AdminDataTableCell>
            </AdminDataTableRow>
          ))}
        </AdminDataTable>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <AdminFormSection title={editing ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}>
            <div className="space-y-5">
              <AdminFormField label="نام دسته‌بندی" required>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 rounded-2xl border-border/70 bg-background/75"
                />
              </AdminFormField>

              <AdminFormField label="توضیحات">
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-28 rounded-[1.35rem] border-border/70 bg-background/75"
                />
              </AdminFormField>

              <BlogCategoryCoverField value={coverImage} name={name} slug={editing?.slug}
                onChange={setCoverImage} onUploadStateChange={setUploading} disabled={saving} />

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={save}
                  disabled={saving || uploading}
                  className="h-11 flex-1 rounded-2xl gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {uploading ? "در حال آپلود کاور..." : editing ? "به‌روزرسانی" : "ثبت دسته‌بندی"}
                </Button>
                {editing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                    disabled={uploading || saving}
                    className="h-11 rounded-2xl"
                  >
                    انصراف
                  </Button>
                ) : null}
              </div>
            </div>
          </AdminFormSection>
        </div>
      </div>
    </div>
  );
}
