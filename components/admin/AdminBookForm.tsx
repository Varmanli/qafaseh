"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";

import AdminFormField from "@/components/admin/AdminFormField";
import AdminFormSection from "@/components/admin/AdminFormSection";
import AdminReferenceCombobox from "@/components/admin/AdminReferenceCombobox";
import AdminReferenceMultiSelect from "@/components/admin/AdminReferenceMultiSelect";
import AdminRichTextEditor from "@/components/admin/AdminRichTextEditor";
import AdminBookExternalLinksEditor, {
  type ExternalLinkDraft,
} from "@/components/admin/AdminBookExternalLinksEditor";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { serializeGenres } from "@/lib/book/genres";
import { sanitizeRichTextHtml } from "@/lib/content/rich-text";
import { ADMIN_BOOK_STRING_LIMITS } from "@/lib/validations/catalog-limits";

const COMMON_LANGUAGES = [
  "فارسی",
  "انگلیسی",
  "فرانسوی",
  "آلمانی",
  "عربی",
  "روسی",
  "ترکی",
  "اسپانیایی",
  "ایتالیایی",
];

type FormState = {
  title: string;
  originalTitle: string;
  author: string;
  genres: string[];
  description: string;
  language: string;
  country: string;
  publisher: string;
  translator: string;
  pageCount: string;
  isbn: string;
  editionLabel: string;
  publishedYear: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export interface AdminBookFormInitialValues {
  id: string;
  slug: string | null;
  title: string;
  originalTitle: string | null;
  author: string;
  genres: string[];
  description: string | null;
  language: string | null;
  country: string | null;
  publisher: string | null;
  translator: string | null;
  pageCount: number | null;
  isbn: string | null;
  editionLabel: string | null;
  publishedYear: number | null;
  coverImage: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  externalLinks?: ExternalLinkDraft[];
}

const EMPTY: FormState = {
  title: "",
  originalTitle: "",
  author: "",
  genres: [],
  description: "",
  language: "",
  country: "",
  publisher: "",
  translator: "",
  pageCount: "",
  isbn: "",
  editionLabel: "",
  publishedYear: "",
  status: "APPROVED",
};

function toFormState(initial: AdminBookFormInitialValues): FormState {
  return {
    title: initial.title ?? "",
    originalTitle: initial.originalTitle ?? "",
    author: initial.author ?? "",
    genres: initial.genres ?? [],
    description: initial.description ?? "",
    language: initial.language ?? "",
    country: initial.country ?? "",
    publisher: initial.publisher ?? "",
    translator: initial.translator ?? "",
    pageCount: initial.pageCount != null ? String(initial.pageCount) : "",
    isbn: initial.isbn ?? "",
    editionLabel: initial.editionLabel ?? "",
    publishedYear:
      initial.publishedYear != null ? String(initial.publishedYear) : "",
    status: initial.status ?? "APPROVED",
  };
}

function comparableLinks(links: ExternalLinkDraft[]) {
  return links.map((link, index) => ({
    provider: link.provider,
    type: link.type,
    url: link.url.trim(),
    label: link.label.trim(),
    isActive: link.isActive,
    sortOrder: index,
  }));
}

interface AdminBookFormProps {
  mode: "create" | "edit";
  /** برای حالت ویرایش: شناسه‌ی کتاب کانونی و مقادیر اولیه. */
  bookId?: string;
  initialValues?: AdminBookFormInitialValues;
}

type ValidationField = {
  path: string
  message: string
  faMessage: string
  receivedLength?: number
  maxLength?: number
}

type ValidationErrorResponse = {
  error?: string
  message?: string
  fields?: ValidationField[]
}

const API_FIELD_TO_FORM_FIELD: Partial<Record<string, keyof FormState>> = {
  title: "title",
  originalTitle: "originalTitle",
  author: "author",
  genre: "genres",
  description: "description",
  language: "language",
  country: "country",
  publisher: "publisher",
  translator: "translator",
  isbn: "isbn",
  editionLabel: "editionLabel",
  pageCount: "pageCount",
  publishedYear: "publishedYear",
  status: "status",
}

const DEV_STRING_LIMITS: Partial<Record<keyof FormState | "genre", number>> = {
  title: ADMIN_BOOK_STRING_LIMITS.title,
  originalTitle: ADMIN_BOOK_STRING_LIMITS.originalTitle,
  author: ADMIN_BOOK_STRING_LIMITS.author,
  genre: ADMIN_BOOK_STRING_LIMITS.genre,
  description: ADMIN_BOOK_STRING_LIMITS.description,
  language: ADMIN_BOOK_STRING_LIMITS.language,
  country: ADMIN_BOOK_STRING_LIMITS.country,
  publisher: ADMIN_BOOK_STRING_LIMITS.publisher,
  translator: ADMIN_BOOK_STRING_LIMITS.translator,
  isbn: ADMIN_BOOK_STRING_LIMITS.isbn,
  editionLabel: ADMIN_BOOK_STRING_LIMITS.editionLabel,
}

function logPayloadDiagnostics(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return

  const overLimit = Object.entries(DEV_STRING_LIMITS)
    .map(([field, maxLength]) => {
      const value = payload[field]
      if (typeof value !== "string") return null
      if (value.length <= (maxLength ?? Number.MAX_SAFE_INTEGER)) return null
      return {
        field,
        receivedLength: value.length,
        maxLength,
      }
    })
    .filter(Boolean)

  if (overLimit.length > 0) {
    console.warn("[AdminBookForm] over-limit payload fields", overLimit)
  }
}

function applyApiValidationErrors(
  fields: ValidationField[] | undefined,
  setErrors: Dispatch<SetStateAction<Partial<Record<keyof FormState, string>>>>,
) {
  if (!fields || fields.length === 0) return false

  const nextErrors: Partial<Record<keyof FormState, string>> = {}
  for (const field of fields) {
    const key = API_FIELD_TO_FORM_FIELD[field.path]
    if (!key || nextErrors[key]) continue
    nextErrors[key] = field.faMessage || field.message
  }

  if (Object.keys(nextErrors).length > 0) {
    setErrors((current) => ({ ...current, ...nextErrors }))
  }

  return true
}

/**
 * فرم مشترکِ ساخت/ویرایش کتاب کاتالوگ در پنل ادمین. هویت = CatalogBook.
 * در حالت ساخت → POST /api/admin/books، در حالت ویرایش → PATCH /api/admin/books/[id].
 */
export default function AdminBookForm({
  mode,
  bookId,
  initialValues,
}: AdminBookFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initialValues ? toFormState(initialValues) : EMPTY,
  );
  const [cover, setCover] = useState<string | null>(
    initialValues?.coverImage ?? null,
  );
  const [links, setLinks] = useState<ExternalLinkDraft[]>(
    initialValues?.externalLinks ?? [],
  );
  const [regenerateSlug, setRegenerateSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});

  const isEdit = mode === "edit";

  // Keep the comparison in the same normalized shape used by submit. This is
  // deliberately independent of React Hook Form: this component owns its
  // fields with useState, and cover/editor/link changes must participate too.
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        form: initialValues ? toFormState(initialValues) : EMPTY,
        cover: initialValues?.coverImage ?? null,
        links: comparableLinks(initialValues?.externalLinks ?? []),
        regenerateSlug: false,
      }),
    [initialValues],
  );
  const currentSnapshot = JSON.stringify({
    form,
    cover,
    links: comparableLinks(links),
    regenerateSlug,
  });
  const isDirty = currentSnapshot !== initialSnapshot;

  const hasRequiredValues =
    form.title.trim() &&
    form.author.trim() &&
    form.genres.length > 0 &&
    Number(form.pageCount) > 0;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.title.trim()) nextErrors.title = "عنوان کتاب الزامی است.";
    if (!form.author.trim()) nextErrors.author = "انتخاب نویسنده الزامی است.";
    if (form.genres.length === 0)
      nextErrors.genres = "حداقل یک دسته‌بندی انتخاب کن.";

    const pages = Number(form.pageCount);
    if (!pages || pages < 1) nextErrors.pageCount = "تعداد صفحات معتبر وارد کن.";

    if (form.publishedYear.trim()) {
      const year = Number(form.publishedYear);
      if (!year || year < 0 || year > 3000) {
        nextErrors.publishedYear = "سال انتشار معتبر نیست.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /**
   * لینک‌های آماده‌ی ارسال: ردیف‌های بدون URL حذف می‌شوند. در صورت خطای اعتبار
   * (URL نامعتبر یا «سایر» بدون برچسب) null برمی‌گرداند و خطا نشان می‌دهد.
   */
  const buildLinksPayload = () => {
    const cleaned = links.filter((l) => l.url.trim());
    for (const link of cleaned) {
      if (!/^https?:\/\//i.test(link.url.trim())) {
        toast.error("آدرس لینک باید با http:// یا https:// شروع شود.");
        return null;
      }
      if (link.provider === "other" && !link.label.trim()) {
        toast.error("برای لینک با فروشگاه «سایر» وارد کردن برچسب الزامی است.");
        return null;
      }
    }
    return cleaned.map((l, index) => ({
      provider: l.provider,
      type: l.type,
      url: l.url.trim(),
      label: l.label.trim() || null,
      isActive: l.isActive,
      sortOrder: index,
    }));
  };

  const submit = async () => {
    if (!validate()) {
      toast.error("چند فیلد مهم هنوز کامل نشده است.");
      return;
    }

    const externalLinks = buildLinksPayload();
    if (externalLinks === null) return;

    setSaving(true);
    try {
      if (isEdit && bookId) {
        // PATCH: همه‌ی فیلدها صریح ارسال می‌شوند (null = پاک‌کردن مقدار).
        const payload = {
          title: form.title.trim(),
          author: form.author.trim(),
          genre: serializeGenres(form.genres),
          originalTitle: form.originalTitle.trim() || null,
          description: form.description.trim()
            ? sanitizeRichTextHtml(form.description)
            : null,
          language: form.language.trim() || null,
          country: form.country.trim() || null,
          publisher: form.publisher.trim() || null,
          translator: form.translator.trim() || null,
          isbn: form.isbn.trim() || null,
          editionLabel: form.editionLabel.trim() || null,
          pageCount: Number(form.pageCount),
          publishedYear: form.publishedYear.trim()
            ? Number(form.publishedYear)
            : null,
          coverImage: cover ?? null,
          status: form.status,
          regenerateSlug,
          externalLinks,
        };

        logPayloadDiagnostics(payload)

        const res = await fetch(`/api/admin/books/${bookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as
          | { error?: string; message?: string }
          | ValidationErrorResponse;
        if (!res.ok) {
          const validation =
            data.error === "VALIDATION_ERROR"
              ? (data as ValidationErrorResponse)
              : null
          const hasFieldErrors = applyApiValidationErrors(
            validation?.fields,
            setErrors,
          )
          const summary =
            validation?.fields?.map((field) => field.faMessage).join(" ") ||
            data.message ||
            data.error ||
            "ذخیره‌ی تغییرات ناموفق بود."
          toast.error(summary)
          if (!hasFieldErrors && !validation) {
            setErrors({})
          }
          return;
        }
        toast.success(data.message || "تغییرات ذخیره شد.");
        router.push("/admin/books");
        router.refresh();
        return;
      }

      // create
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        author: form.author.trim(),
        genre: serializeGenres(form.genres),
        pageCount: Number(form.pageCount),
      };
      if (form.originalTitle.trim())
        payload.originalTitle = form.originalTitle.trim();
      if (form.description.trim())
        payload.description = sanitizeRichTextHtml(form.description);
      if (form.language.trim()) payload.language = form.language.trim();
      if (form.country.trim()) payload.country = form.country.trim();
      if (form.publisher.trim()) payload.publisher = form.publisher.trim();
      if (form.translator.trim()) payload.translator = form.translator.trim();
      if (form.isbn.trim()) payload.isbn = form.isbn.trim();
      if (form.editionLabel.trim())
        payload.editionLabel = form.editionLabel.trim();
      if (form.publishedYear.trim())
        payload.publishedYear = Number(form.publishedYear);
      if (cover) payload.coverImage = cover;
      if (externalLinks.length > 0) payload.externalLinks = externalLinks;

      logPayloadDiagnostics(payload)

      const res = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as
        | { error?: string; message?: string }
        | ValidationErrorResponse;
      if (!res.ok) {
        const validation =
          data.error === "VALIDATION_ERROR"
            ? (data as ValidationErrorResponse)
            : null
        applyApiValidationErrors(validation?.fields, setErrors)
        const summary =
          validation?.fields?.map((field) => field.faMessage).join(" ") ||
          data.message ||
          data.error ||
          "ثبت کتاب ناموفق بود."
        toast.error(summary)
        return;
      }
      toast.success(data.message || "کتاب با موفقیت ثبت شد.");
      router.push("/admin/books");
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative z-0 space-y-6">
          <AdminFormSection title="اطلاعات اصلی کتاب">
            <div className="grid gap-5 lg:grid-cols-2">
              <AdminFormField label="عنوان کتاب" required error={errors.title}>
                <Input
                  value={form.title}
                  onChange={(event) => setField("title", event.target.value)}
                  className="h-12 rounded-2xl border-border/70 bg-background/75"
                />
              </AdminFormField>

              <AdminFormField
                label="عنوان به زبان اصلی"
                error={errors.originalTitle}
              >
                <Input
                  dir="ltr"
                  value={form.originalTitle}
                  onChange={(event) =>
                    setField("originalTitle", event.target.value)
                  }
                  className="h-12 rounded-2xl border-border/70 bg-background/75"
                />
              </AdminFormField>
            </div>
          </AdminFormSection>

          <AdminFormSection title="نویسنده و عوامل">
            <div className="grid gap-5 md:grid-cols-2">
              <AdminFormField label="نویسنده" required error={errors.author}>
                <AdminReferenceCombobox
                  type="AUTHOR"
                  value={form.author}
                  onChange={(value) => setField("author", value)}
                  placeholder="جست‌وجو در نویسنده‌ها..."
                  manageHref="/admin/reference"
                  invalid={Boolean(errors.author)}
                />
              </AdminFormField>

              <AdminFormField label="مترجم" error={errors.translator}>
                <AdminReferenceCombobox
                  type="TRANSLATOR"
                  value={form.translator}
                  onChange={(value) => setField("translator", value)}
                  placeholder="جست‌وجو در مترجم‌ها..."
                  manageHref="/admin/reference"
                  invalid={Boolean(errors.translator)}
                />
              </AdminFormField>

              <AdminFormField label="ناشر" error={errors.publisher}>
                <AdminReferenceCombobox
                  type="PUBLISHER"
                  value={form.publisher}
                  onChange={(value) => setField("publisher", value)}
                  placeholder="جست‌وجو در ناشرها..."
                  manageHref="/admin/reference"
                  invalid={Boolean(errors.publisher)}
                />
              </AdminFormField>

              <AdminFormField label="کشور" error={errors.country}>
                <AdminReferenceCombobox
                  type="COUNTRY"
                  value={form.country}
                  onChange={(value) => setField("country", value)}
                  placeholder="جست‌وجو در کشورها..."
                  manageHref="/admin/reference"
                  invalid={Boolean(errors.country)}
                />
              </AdminFormField>
            </div>
          </AdminFormSection>

          <AdminFormSection title="دسته‌بندی‌ها و مشخصات">
            <div className="space-y-5">
              <AdminFormField label="دسته‌بندی‌ها" required error={errors.genres}>
                <AdminReferenceMultiSelect
                  type="GENRE"
                  values={form.genres}
                  onChange={(values) => setField("genres", values)}
                  placeholder="جست‌وجو و افزودن دسته‌بندی..."
                  invalid={Boolean(errors.genres)}
                />
              </AdminFormField>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <AdminFormField label="زبان" error={errors.language}>
                  <AdminReferenceCombobox
                    value={form.language}
                    onChange={(value) => setField("language", value)}
                    placeholder="جست‌وجو در زبان‌ها..."
                    localOptions={COMMON_LANGUAGES}
                    invalid={Boolean(errors.language)}
                  />
                </AdminFormField>

                <AdminFormField
                  label="تعداد صفحات"
                  required
                  error={errors.pageCount}
                >
                  <Input
                    inputMode="numeric"
                    value={form.pageCount}
                    onChange={(event) =>
                      setField(
                        "pageCount",
                        event.target.value.replace(/[^0-9]/g, ""),
                      )
                    }
                    className="h-12 rounded-2xl border-border/70 bg-background/75"
                  />
                </AdminFormField>

                <AdminFormField label="سال انتشار" error={errors.publishedYear}>
                  <Input
                    inputMode="numeric"
                    value={form.publishedYear}
                    onChange={(event) =>
                      setField(
                        "publishedYear",
                        event.target.value.replace(/[^0-9]/g, ""),
                      )
                    }
                    className="h-12 rounded-2xl border-border/70 bg-background/75"
                  />
                </AdminFormField>

                <AdminFormField label="شابک" error={errors.isbn}>
                  <Input
                    dir="ltr"
                    value={form.isbn}
                    onChange={(event) => setField("isbn", event.target.value)}
                    className="h-12 rounded-2xl border-border/70 bg-background/75"
                  />
                </AdminFormField>

                <AdminFormField
                  label="عنوان نسخه/چاپ"
                  error={errors.editionLabel}
                >
                  <Input
                    value={form.editionLabel}
                    onChange={(event) =>
                      setField("editionLabel", event.target.value)
                    }
                    className="h-12 rounded-2xl border-border/70 bg-background/75"
                  />
                </AdminFormField>
              </div>
            </div>
          </AdminFormSection>

          <AdminFormSection title="توضیحات">
            <div>
              <AdminRichTextEditor
                value={form.description}
                onChange={(value) => setField("description", value)}
                placeholder="خلاصه، فضای اثر، نکات مهم یا معرفی کوتاه کتاب را اینجا بنویس..."
              />
              {errors.description ? <p className="mt-2 text-xs font-medium text-destructive">{errors.description}</p> : null}
            </div>
          </AdminFormSection>

          <AdminFormSection title="لینک‌های خرید و مطالعه">
            <AdminBookExternalLinksEditor value={links} onChange={setLinks} />
          </AdminFormSection>
        </div>

        <aside className="relative z-30 space-y-3 pt-2 xl:sticky xl:top-20 xl:self-start">
          <div className="overflow-visible rounded-[1.5rem] border border-primary/15 bg-gradient-to-b from-card to-background/70 p-4 shadow-[0_24px_70px_-56px_rgba(0,0,0,0.85)]">
            <AdminFormField label="جلد کتاب" className="text-right">
              <ImageUploader
                value={cover}
                onChange={(url) => setCover(url || null)}
                folder="covers"
                aspect="cover"
                placeholder="انتخاب تصویر جلد"
                disabled={saving}
                className="mx-auto max-w-[190px]"
              />
            </AdminFormField>

            <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
              <Button
                onClick={submit}
                disabled={saving || !hasRequiredValues || (isEdit && !isDirty)}
                className="h-11 w-full rounded-xl gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEdit ? "ذخیره‌ی تغییرات" : "ثبت کتاب"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/admin/books")}
                disabled={saving}
                className="h-10 w-full rounded-xl"
              >
                <ArrowRight className="h-4 w-4" />
                بازگشت به لیست کتاب‌ها
              </Button>
            </div>
          </div>

          {isEdit ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/90 shadow-[0_18px_50px_-42px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <span className="text-sm font-black">وضعیت انتشار</span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                  {form.status === "APPROVED" ? "فعال" : form.status === "PENDING" ? "در انتظار" : "ردشده"}
                </span>
              </div>
              <div className="space-y-3 p-4">
              <div className="w-full">
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setField("status", v as FormState["status"])
                  }
                >
                  <SelectTrigger className="h-12 w-full rounded-xl border-border/70 bg-background/70 px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">تأییدشده</SelectItem>
                    <SelectItem value="PENDING">در انتظار</SelectItem>
                    <SelectItem value="REJECTED">ردشده</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 p-3 transition-colors hover:border-primary/30">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Link2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-foreground">لینک عمومی کتاب</span>
                    <span dir="ltr" className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                      {initialValues?.slug ? `/book/${initialValues.slug}` : "با عنوان کتاب ساخته می‌شود"}
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={regenerateSlug}
                  onChange={(e) => setRegenerateSlug(e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                  aria-label="بازسازی لینک عمومی"
                />
              </label>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
