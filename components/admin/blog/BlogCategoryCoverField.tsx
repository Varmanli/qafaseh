"use client";

import { ImageUploader } from "@/components/upload/ImageUploader";
import AdminFormField from "@/components/admin/AdminFormField";
import BlogCategoryCover from "@/components/blog/BlogCategoryCover";
import { normalizeBlogCategorySlug } from "@/lib/blog/category-slug";

export default function BlogCategoryCoverField({ value, name, slug, onChange, onUploadStateChange, disabled }: {
  value: string | null;
  name: string;
  slug?: string;
  onChange: (value: string | null) => void;
  onUploadStateChange: (uploading: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <AdminFormField label="کاور دسته‌بندی">
      <p className="text-xs leading-6 text-muted-foreground">این کاور در صفحه اصلی، مجله و بالای صفحه دسته نمایش داده می‌شود. پیشنهاد: تصویر افقی ۱۲۰۰ × ۷۲۰ پیکسل.</p>
      <ImageUploader value={value} onChange={(url) => onChange(url || null)}
        folder="blog" aspect="wide" disabled={disabled} onUploadStateChange={onUploadStateChange}
        description="JPG، PNG یا WEBP تا ۵۰۰ کیلوبایت"
        placeholder="تصویر کاور را انتخاب کن یا اینجا رها کن" />
      {!value ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border/60">
          <div className="relative aspect-[5/3]">
            <BlogCategoryCover slug={slug || normalizeBlogCategorySlug(name) || "reading-guide"} sizes="360px" />
          </div>
          <p className="bg-muted/30 px-3 py-2 text-[11px] leading-6 text-muted-foreground">کاور پیش‌فرض؛ با آپلود تصویر، کاور اختصاصی جایگزین می‌شود.</p>
        </div>
      ) : null}
    </AdminFormField>
  );
}
