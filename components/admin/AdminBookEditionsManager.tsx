"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import AdminFormField from "@/components/admin/AdminFormField";
import AdminFormSection from "@/components/admin/AdminFormSection";
import AdminReferenceCombobox from "@/components/admin/AdminReferenceCombobox";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  compareEditionSets,
  findDuplicateEditionIds,
  validatePrimaryEditionResponse,
} from "@/lib/admin/edition-set-invariants";
import type { AdminBookEditionRow } from "@/lib/admin/service";
import { getEditionCoverSrc } from "@/lib/book/cover";

type EditionFormState = {
  titleOverride: string;
  translator: string;
  publisher: string;
  isbn10: string;
  isbn13: string;
  publishedYear: string;
  pageCount: string;
  coverImage: string | null;
  editionDescription: string;
  editionLabel: string;
  language: string;
  format: "PHYSICAL" | "ELECTRONIC";
  status: "PENDING" | "APPROVED" | "REJECTED";
  sourceName: string;
  sourceUrl: string;
  sourceEditionCode: string;
};

type PrimaryEditionResponse = {
  success?: boolean;
  catalogBookId?: string;
  catalogBook?: { id?: string; primaryEditionId?: string | null };
  previousPrimaryEditionId?: string | null;
  primaryEditionId?: string | null;
  editionIdsBefore?: string[];
  editionIdsAfter?: string[];
  editions?: AdminBookEditionRow[];
  message?: string;
  error?: string;
};

const EMPTY_FORM: EditionFormState = {
  titleOverride: "",
  translator: "",
  publisher: "",
  isbn10: "",
  isbn13: "",
  publishedYear: "",
  pageCount: "",
  coverImage: null,
  editionDescription: "",
  editionLabel: "",
  language: "",
  format: "PHYSICAL",
  status: "PENDING",
  sourceName: "",
  sourceUrl: "",
  sourceEditionCode: "",
};

function toFormState(edition?: AdminBookEditionRow | null): EditionFormState {
  if (!edition) return EMPTY_FORM;
  return {
    titleOverride: edition.titleOverride ?? "",
    translator: edition.translator ?? "",
    publisher: edition.publisher ?? "",
    isbn10: edition.isbn10 ?? "",
    isbn13: edition.isbn13 ?? "",
    publishedYear:
      edition.publishedYear != null ? String(edition.publishedYear) : "",
    pageCount: edition.pageCount != null ? String(edition.pageCount) : "",
    coverImage: edition.coverImage ?? null,
    editionDescription: edition.editionDescription ?? "",
    editionLabel: edition.editionLabel ?? "",
    language: edition.language ?? "",
    format: edition.format,
    status: edition.status,
    sourceName: edition.sourceName ?? "",
    sourceUrl: edition.sourceUrl ?? "",
    sourceEditionCode: edition.sourceEditionCode ?? "",
  };
}

function sortedEditionIds(editions: AdminBookEditionRow[]) {
  return editions.map((edition) => edition.id).sort();
}

function getPrimaryEditionId(editions: AdminBookEditionRow[]) {
  return editions.find((edition) => edition.isPrimary)?.id ?? null;
}

function snapshotEdition(edition: AdminBookEditionRow) {
  return {
    id: edition.id,
    titleOverride: edition.titleOverride,
    publisher: edition.publisher,
    translator: edition.translator,
    coverFilename: edition.coverFilename,
    coverImage: edition.coverImage,
    isbn10: edition.isbn10,
    isbn13: edition.isbn13,
  };
}

export default function AdminBookEditionsManager({
  catalogBookId,
  bookTitle,
  originalTitle,
  author,
  genres,
  editions,
}: {
  catalogBookId: string;
  bookTitle: string;
  originalTitle: string | null;
  author: string;
  genres: string[];
  editions: AdminBookEditionRow[];
}) {
  const [items, setItems] = useState(editions);
  const [primaryEditionId, setPrimaryEditionId] = useState(
    getPrimaryEditionId(editions),
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBookEditionRow | null>(null);
  const [form, setForm] = useState<EditionFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  useEffect(() => {
    setItems(editions);
    setPrimaryEditionId(getPrimaryEditionId(editions));
  }, [editions]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const duplicateIds = findDuplicateEditionIds(items);
    if (duplicateIds.length > 0) {
      console.error("AdminBookEditionsManager rendered duplicate edition ids.", {
        catalogBookId,
        duplicateIds,
        ids: sortedEditionIds(items),
      });
    }
  }, [catalogBookId, items]);

  const contextLine = useMemo(
    () =>
      [author, genres.length > 0 ? genres.join("، ") : null]
        .filter(Boolean)
        .join(" • "),
    [author, genres],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(edition: AdminBookEditionRow) {
    setEditing(edition);
    setForm(toFormState(edition));
    setOpen(true);
  }

  function setField<K extends keyof EditionFormState>(
    key: K,
    value: EditionFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refreshEditions() {
    const res = await fetch(`/api/admin/books/${catalogBookId}/editions`, {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "بارگیری نسخه‌ها ناموفق بود");
    }

    const nextItems = data.editions ?? [];
    setItems(nextItems);
    setPrimaryEditionId(getPrimaryEditionId(nextItems));
    return nextItems as AdminBookEditionRow[];
  }

  async function setPrimaryEdition(editionId: string) {
    setSettingPrimaryId(editionId);
    const beforeItems = [...items];
    const beforeSnapshots = beforeItems.map(snapshotEdition);
    const previousPrimaryEditionId = primaryEditionId;
    try {
      const res = await fetch(
        `/api/admin/catalog-books/${catalogBookId}/primary-edition`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ editionId }),
        },
      );
      const data = (await res.json()) as PrimaryEditionResponse;
      if (!res.ok) {
        toast.error(data.error || "بروزرسانی نسخه اصلی ناموفق بود");
        return;
      }

      const payloadInvariant = validatePrimaryEditionResponse(catalogBookId, data);
      const nextItems = payloadInvariant.editions as AdminBookEditionRow[] | null;
      if (!nextItems) {
        console.error("Primary edition response was missing an edition list.", {
          catalogBookId,
          apiResponse: data,
        });
        toast.error("پاسخ سرور نامعتبر است؛ فهرست نسخه‌ها بدون تغییر ماند.");
        return;
      }
      const invariant = compareEditionSets(beforeItems, nextItems);
      const selectedExistsInResponse = nextItems.some(
        (edition) => edition.id === editionId,
      );
      const previousPrimaryWasValid =
        previousPrimaryEditionId !== null &&
        beforeItems.some((edition) => edition.id === previousPrimaryEditionId);
      const previousPrimaryExistsInResponse =
        previousPrimaryEditionId === null ||
        !previousPrimaryWasValid ||
        nextItems.some((edition) => edition.id === previousPrimaryEditionId);

      if (
        !invariant.ok ||
        !payloadInvariant.ok ||
        !selectedExistsInResponse ||
        !previousPrimaryExistsInResponse
      ) {
        console.error("Primary edition response failed edition-list invariants.", {
          catalogBookId,
          beforeIds: invariant.beforeIds,
          afterIds: invariant.afterIds,
          beforeCount: invariant.beforeCount,
          afterCount: invariant.afterCount,
          missingIds: invariant.missingIds,
          addedIds: invariant.addedIds,
          duplicateIds: invariant.duplicateIds,
          selectedEditionId: editionId,
          previousPrimaryEditionId,
          selectedExistsInResponse,
          previousPrimaryExistsInResponse,
          responseBookId: payloadInvariant.responseBookId,
          crossBookEditionIds: payloadInvariant.crossBookEditionIds,
          beforeSnapshots,
          apiResponse: data,
        });

        toast.error("خطا در به‌روزرسانی نسخه اصلی؛ لیست نسخه‌ها نامعتبر برگشت.");
        return;
      }

      setPrimaryEditionId(data.primaryEditionId ?? editionId);
      setItems(nextItems);
      toast.success(data.message || "نسخه اصلی کتاب انتخاب شد");
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSettingPrimaryId(null);
    }
  }

  async function submit() {
    const payload = {
      titleOverride: form.titleOverride || null,
      translator: form.translator || null,
      publisher: form.publisher || null,
      isbn10: form.isbn10 || null,
      isbn13: form.isbn13 || null,
      publishedYear: form.publishedYear ? Number(form.publishedYear) : null,
      pageCount: form.pageCount ? Number(form.pageCount) : null,
      coverImage: form.coverImage ?? null,
      editionDescription: form.editionDescription || null,
      editionLabel: form.editionLabel || null,
      language: form.language || null,
      format: form.format,
      status: form.status,
      sourceName: form.sourceName || null,
      sourceUrl: form.sourceUrl || null,
      sourceEditionCode: form.sourceEditionCode || null,
    };

    setSubmitting(true);
    try {
      const res = await fetch(
        editing
          ? `/api/admin/editions/${editing.id}`
          : `/api/admin/books/${catalogBookId}/editions`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ذخیره‌ی نسخه ناموفق بود");
        return;
      }

      toast.success(data.message || "نسخه ذخیره شد");
      setOpen(false);
      await refreshEditions();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeEdition(id: string) {
    if (!window.confirm("این نسخه حذف شود؟")) return;

    try {
      const res = await fetch(`/api/admin/editions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "حذف نسخه ناموفق بود");
        return;
      }
      toast.success(data.message || "نسخه حذف شد");
      await refreshEditions();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    }
  }

  return (
    <>
      <AdminFormSection title="نسخه‌ها و ترجمه‌ها" className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="relative overflow-hidden rounded-[1.4rem] border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card/80 to-background/50 p-4 shadow-sm">
            <div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-primary/25 to-transparent" />

            <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="line-clamp-1 text-base font-black text-foreground">
                  {bookTitle}
                </p>

              </div>

              <span className="inline-flex shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
                {items.length.toLocaleString("fa-IR")} نسخه
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/50 px-4 py-3 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground">نسخه اصلی</span>
            <p className="text-sm font-bold text-foreground">
              {items.find((edition) => edition.id === primaryEditionId)
                ?.editionLabel ||
                items.find((edition) => edition.id === primaryEditionId)
                  ?.titleOverride ||
                items.find((edition) => edition.id === primaryEditionId)
                  ?.publisher ||
                "هنوز نسخه اصلی انتخاب نشده است"}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-foreground">
                نسخه‌های ثبت‌شده
              </p>
            </div>

            <Button
              type="button"
              onClick={openCreate}
              className="h-10 rounded-xl px-4 font-bold shadow-lg shadow-primary/10"
            >
              <Plus className="h-4 w-4" />
              افزودن نسخه / ترجمه
            </Button>
          </div>

          {items.length > 0 ? (
            <div className="grid gap-4">
              {items.map((edition) => {
                const coverSrc = getEditionCoverSrc(edition);
                const isCurrentPrimary = edition.id === primaryEditionId;

                const primaryMeta = [
                  edition.translator ? `مترجم: ${edition.translator}` : null,
                  edition.publisher ? `ناشر: ${edition.publisher}` : null,
                  edition.publishedYear
                    ? `سال چاپ: ${edition.publishedYear.toLocaleString("fa-IR")}`
                    : null,
                  edition.pageCount
                    ? `${edition.pageCount.toLocaleString("fa-IR")} صفحه`
                    : null,
                ].filter(Boolean);

                return (
                  <div
                    key={edition.id}
                    className={cn(
                      "group relative overflow-hidden rounded-[1.5rem] border bg-card/75 p-4 shadow-[0_18px_60px_-46px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:bg-card",
                      isCurrentPrimary ? "border-primary/35 ring-1 ring-primary/10" : "border-border/70 hover:border-primary/25",
                    )}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="relative h-28 w-[74px] shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-sm">
                          {coverSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={coverSrc}
                              alt={bookTitle}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-background/60 px-2 text-center">
                              <span className="text-[10px] font-black text-muted-foreground">
                                بدون جلد
                              </span>
                              <span className="text-[9px] leading-4 text-muted-foreground/80">
                                جلد نسخه هنوز ثبت نشده
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="line-clamp-1 text-sm font-black text-foreground">
                              {edition.editionLabel ||
                                edition.titleOverride ||
                                "نسخه / ترجمه"}
                            </p>

                            <StatusBadge status={edition.status} />

                            {isCurrentPrimary ? (
                              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                                نسخه اصلی
                              </span>
                            ) : null}
                          </div>

                          {primaryMeta.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {primaryMeta.map((item) => (
                                <span
                                  key={item}
                                  className="inline-flex rounded-full border border-border/70 bg-background/55 px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 rounded-2xl border border-dashed border-border/70 bg-background/45 px-3 py-2 text-xs leading-6 text-muted-foreground">
                              اطلاعات شناسایی این نسخه هنوز کم است.
                            </p>
                          )}

                        </div>
                      </div>

                      <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                        <Button
                          type="button"
                          variant={isCurrentPrimary ? "secondary" : "outline"}
                          onClick={() => setPrimaryEdition(edition.id)}
                          disabled={
                            isCurrentPrimary || settingPrimaryId === edition.id
                          }
                          className="h-10 flex-1 rounded-xl border-border/80 bg-background/50 font-bold lg:flex-none"
                        >
                          {settingPrimaryId === edition.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          {isCurrentPrimary
                            ? "نسخه اصلی"
                            : "انتخاب به عنوان نسخه اصلی"}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEdit(edition)}
                          className="h-10 flex-1 rounded-xl border-border/80 bg-background/50 font-bold lg:flex-none"
                        >
                          <Pencil className="h-4 w-4" />
                          ویرایش
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeEdition(edition.id)}
                          className="h-10 flex-1 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive lg:flex-none"
                        >
                          <Trash2 className="h-4 w-4" />
                          حذف
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.7rem] border border-dashed border-border/75 bg-background/45 px-4 py-10 text-center">
              <p className="text-sm font-black text-foreground">
                هنوز نسخه‌ای برای این کتاب ثبت نشده
              </p>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
                اولین نسخه، ترجمه، چاپ یا ناشر این کتاب را اضافه کنید تا کاربران
                بتوانند دقیق‌تر همان نسخه را انتخاب کنند.
              </p>

              <Button
                type="button"
                onClick={openCreate}
                className="mt-5 rounded-2xl px-5 font-bold"
              >
                <Plus className="h-4 w-4" />
                افزودن اولین نسخه
              </Button>
            </div>
          )}
        </div>
      </AdminFormSection>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] border-border bg-card p-0 shadow-2xl sm:max-w-4xl">
          <div className="sticky top-0 z-10 border-b border-border/70 bg-card/95 px-5 py-4 backdrop-blur-xl">
            <DialogTitle className="text-lg font-black text-foreground">
              {editing ? "ویرایش نسخه" : "افزودن نسخه / ترجمه جدید"}
            </DialogTitle>

            <DialogDescription className="mt-1 text-xs leading-6 text-muted-foreground">
              فیلدهای این فرم فقط مخصوص نسخه هستند و روی خود کتاب کانونی ذخیره
              نمی‌شوند.
            </DialogDescription>
          </div>

          <div className="space-y-6 px-5 py-5">
            <div className="rounded-[1.4rem] border border-border/70 bg-background/55 p-4">
              <p className="line-clamp-1 text-sm font-black text-foreground">
                {bookTitle}
              </p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {contextLine}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <AdminFormField label="عنوان نسخه / چاپ">
                <Input
                  value={form.editionLabel}
                  onChange={(e) => setField("editionLabel", e.target.value)}
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="عنوان جایگزین">
                <Input
                  value={form.titleOverride}
                  onChange={(e) => setField("titleOverride", e.target.value)}
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="مترجم">
                <AdminReferenceCombobox
                  type="TRANSLATOR"
                  value={form.translator}
                  onChange={(value) => setField("translator", value)}
                  placeholder="جست‌وجو در مترجم‌ها..."
                  manageHref="/admin/reference"
                />
              </AdminFormField>

              <AdminFormField label="ناشر">
                <AdminReferenceCombobox
                  type="PUBLISHER"
                  value={form.publisher}
                  onChange={(value) => setField("publisher", value)}
                  placeholder="جست‌وجو در ناشرها..."
                  manageHref="/admin/reference"
                />
              </AdminFormField>

              <AdminFormField label="شابک ۱۰">
                <Input
                  dir="ltr"
                  value={form.isbn10}
                  onChange={(e) => setField("isbn10", e.target.value)}
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="شابک ۱۳">
                <Input
                  dir="ltr"
                  value={form.isbn13}
                  onChange={(e) => setField("isbn13", e.target.value)}
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="سال چاپ">
                <Input
                  inputMode="numeric"
                  value={form.publishedYear}
                  onChange={(e) =>
                    setField(
                      "publishedYear",
                      e.target.value.replace(/[^0-9]/g, ""),
                    )
                  }
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="تعداد صفحات">
                <Input
                  inputMode="numeric"
                  value={form.pageCount}
                  onChange={(e) =>
                    setField("pageCount", e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="زبان نسخه">
                <Input
                  value={form.language}
                  onChange={(e) => setField("language", e.target.value)}
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="نوع نسخه">
                <Select
                  value={form.format}
                  onValueChange={(v) =>
                    setField("format", v as EditionFormState["format"])
                  }
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHYSICAL">فیزیکی</SelectItem>
                    <SelectItem value="ELECTRONIC">دیجیتال</SelectItem>
                  </SelectContent>
                </Select>
              </AdminFormField>

              <AdminFormField label="وضعیت">
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setField("status", v as EditionFormState["status"])
                  }
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">در انتظار</SelectItem>
                    <SelectItem value="APPROVED">تأییدشده</SelectItem>
                    <SelectItem value="REJECTED">ردشده</SelectItem>
                  </SelectContent>
                </Select>
              </AdminFormField>

              <AdminFormField label="منبع">
                <Input
                  value={form.sourceName}
                  onChange={(e) => setField("sourceName", e.target.value)}
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="آدرس منبع">
                <Input
                  dir="ltr"
                  value={form.sourceUrl}
                  onChange={(e) => setField("sourceUrl", e.target.value)}
                  className="rounded-2xl"
                />
              </AdminFormField>

              <AdminFormField label="کد منبع نسخه">
                <Input
                  value={form.sourceEditionCode}
                  onChange={(e) =>
                    setField("sourceEditionCode", e.target.value)
                  }
                  className="rounded-2xl"
                />
              </AdminFormField>
            </div>

            <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
              <AdminFormField label="جلد نسخه">
                <ImageUploader
                  value={form.coverImage}
                  onChange={(url) => setField("coverImage", url || null)}
                  folder="covers"
                  aspect="cover"
                  placeholder="برای انتخاب جلد کلیک کن یا فایل را رها کن"
                  description="این جلد فقط به همین نسخه تعلق دارد."
                  disabled={submitting}
                  className="max-w-[220px]"
                />
              </AdminFormField>

              <AdminFormField label="توضیح نسخه">
                <Textarea
                  value={form.editionDescription}
                  onChange={(e) =>
                    setField("editionDescription", e.target.value)
                  }
                  className="min-h-40 rounded-2xl border-border bg-background/55 text-sm leading-7"
                  placeholder="مثلاً کیفیت ترجمه، چاپ یا اطلاعات تکمیلی این نسخه..."
                />
              </AdminFormField>
            </div>

            <div className="rounded-[1.4rem] border border-border/70 bg-background/55 px-4 py-3 text-xs leading-6 text-muted-foreground">
              این نسخه باید حداقل یک مشخصه‌ی شناسایی مثل مترجم، ناشر، شابک، جلد
              یا سال چاپ داشته باشد.
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border/70 bg-card/95 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded-2xl"
            >
              بستن
            </Button>

            <Button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-2xl px-5 font-bold"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "ذخیره نسخه" : "ثبت نسخه"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({
  status,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const label =
    status === "APPROVED"
      ? "تأییدشده"
      : status === "REJECTED"
        ? "ردشده"
        : "در انتظار";
  const className =
    status === "APPROVED"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
      : status === "REJECTED"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
        : "border-amber-500/20 bg-amber-500/10 text-amber-600";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${className}`}
    >
      {label}
    </span>
  );
}
