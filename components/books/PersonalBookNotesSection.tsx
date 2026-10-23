"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Globe2,
  Loader2,
  LockKeyhole,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { detectTextDirection } from "@/lib/text-direction";

type PersonalNote = {
  id: string;
  content: string;
  pageNumber: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  publicThoughtId: string | null;
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function PersonalBookNotesSection({
  bookId,
  pageCount,
  isLoggedIn,
}: {
  bookId: string | null;
  pageCount: number | null;
  isLoggedIn: boolean;
}) {
  const confirm = useConfirm();
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(Boolean(bookId));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalNote | null>(null);
  const [content, setContent] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<PersonalNote | null>(null);
  const [sharedContent, setSharedContent] = useState("");
  const [sharedPage, setSharedPage] = useState("");
  const [sharedType, setSharedType] = useState("THOUGHT");
  const [publishing, setPublishing] = useState(false);
  const unavailable = !isLoggedIn || !bookId;

  const load = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}/personal-notes`);
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "دریافت یادداشت‌ها ناموفق بود");
      setNotes(data.notes);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "خطا در دریافت یادداشت‌ها",
      );
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setContent("");
    setPageNumber("");
    setOpen(true);
  }
  function openEdit(note: PersonalNote) {
    setEditing(note);
    setContent(note.content);
    setPageNumber(note.pageNumber ? String(note.pageNumber) : "");
    setOpen(true);
  }
  function openShare(note: PersonalNote) {
    setSharing(note);
    setSharedContent(note.content);
    setSharedPage(note.pageNumber ? String(note.pageNumber) : "");
    setSharedType("THOUGHT");
  }

  async function submit() {
    if (!bookId || !content.trim()) {
      toast.error("متن یادداشت را بنویس");
      return;
    }
    const page = pageNumber.trim() ? Number(pageNumber) : null;
    if (
      page !== null &&
      (!Number.isInteger(page) || page < 1 || (pageCount && page > pageCount))
    ) {
      toast.error(
        pageCount
          ? `شماره صفحه باید بین ۱ تا ${pageCount} باشد`
          : "شماره صفحه نامعتبر است",
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing
          ? `/api/personal-notes/${editing.id}`
          : `/api/books/${bookId}/personal-notes`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim(), pageNumber: page }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ذخیره‌ی یادداشت ناموفق بود");
      setOpen(false);
      toast.success(
        editing ? "یادداشت به‌روزرسانی شد" : "یادداشت در دفترچه‌ات ثبت شد",
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!sharing || !sharedContent.trim()) {
      toast.error("متن لحظه را بنویس");
      return;
    }
    const page = sharedPage.trim() ? Number(sharedPage) : null;
    if (
      page !== null &&
      (!Number.isInteger(page) || page < 1 || (pageCount && page > pageCount))
    ) {
      toast.error("شماره صفحه نامعتبر است");
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch(`/api/personal-notes/${sharing.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: sharedContent.trim(),
          pageNumber: page,
          type: sharedType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "انتشار لحظه ناموفق بود");
      setSharing(null);
      toast.success("لحظه در صفحه عمومی کتاب منتشر شد");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در انتشار");
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish(note: PersonalNote) {
    await confirm({
      title: "برداشتن از صفحه عمومی",
      description:
        "این لحظه فقط از صفحه عمومی کتاب برداشته می‌شود؛ یادداشت خصوصی‌ات حفظ خواهد شد.",
      confirmLabel: "برداشتن",
      onConfirm: async () => {
        const res = await fetch(`/api/personal-notes/${note.id}/share`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "برداشتن از انتشار ناموفق بود");
          return;
        }
        toast.success("لحظه از صفحه عمومی برداشته شد");
        await load();
      },
    });
  }

  async function remove(note: PersonalNote) {
    await confirm({
      title: "حذف یادداشت",
      description:
        "این یادداشت از دفترچه‌ی شخصی‌ات حذف شود؟ این کار قابل بازگشت نیست.",
      onConfirm: async () => {
        const res = await fetch(`/api/personal-notes/${note.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "حذف یادداشت ناموفق بود");
          return;
        }
        setNotes((current) => current.filter((item) => item.id !== note.id));
        toast.success("یادداشت حذف شد");
      },
    });
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-md transition-all hover:border-border/80 sm:p-5">
      {/* Ambient Subtle Glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <NotebookPen className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                یادداشت‌های من
              </h2>
              <p className="text-xs text-muted-foreground/80">
                دفترچه‌ی خصوصی لحظه‌ها و فکرهای این کتاب
              </p>
            </div>
          </div>

          <Button
            type="button"
            disabled={unavailable}
            onClick={openAdd}
            size="sm"
            className="h-9 rounded-xl px-3.5 text-xs font-semibold gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن یادداشت
          </Button>
        </div>

        {/* States: Unavailable / Loading / Empty / List */}
        {unavailable ? (
          <p className="mt-4 rounded-xl border border-dashed border-border/70 bg-background/30 p-4 text-center text-xs leading-relaxed text-muted-foreground">
            برای ساخت دفترچه‌ی شخصی، ابتدا کتاب را به قفسه‌ات اضافه کن.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : notes.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-border/70 bg-background/30 px-4 py-8 text-center">
            <NotebookPen className="mx-auto h-6 w-6 text-primary/70" />
            <h3 className="mt-2.5 text-xs font-bold text-foreground sm:text-sm">
              هنوز یادداشتی ثبت نکرده‌ای
            </h3>
            <p className="mt-1 text-xs text-muted-foreground/80">
              لحظه‌ها و فکرهای مهم این کتاب را برای خودت ذخیره کن.
            </p>
            <Button
              type="button"
              onClick={openAdd}
              size="sm"
              variant="secondary"
              className="mt-3.5 h-8 rounded-lg px-3 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن اولین یادداشت
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {notes.map((note) => (
              <article
                key={note.id}
                className="group rounded-xl border border-border/40 bg-background/40 p-3.5 transition-colors hover:border-border/70 hover:bg-background/60"
              >
                {/* Note Meta & Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    {note.pageNumber ? (
                      <>
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>
                          صفحه‌ی {note.pageNumber.toLocaleString("fa-IR")}
                        </span>
                      </>
                    ) : (
                      <>
                        <NotebookPen className="h-3.5 w-3.5" />
                        <span>یادداشت کلی</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(note)}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void remove(note)}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <p dir={detectTextDirection(note.content)} className="persian-paragraph mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 sm:text-sm">
                  {note.content}
                </p>

                {/* Footer Status & Date */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(note.createdAt)}
                  </p>

                  {note.publicThoughtId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void unpublish(note)}
                      className="h-7 rounded-lg border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 gap-1"
                    >
                      <Globe2 className="h-3 w-3" />
                      منتشرشده · برداشتن
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openShare(note)}
                      className="h-7 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:text-primary gap-1"
                    >
                      <LockKeyhole className="h-3 w-3" />
                      خصوصی · انتشار عمومی
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create/Edit Note */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border/80 bg-card p-5 shadow-xl sm:max-w-md">
          <DialogTitle className="text-base font-bold text-foreground">
            {editing ? "ویرایش یادداشت" : "یادداشت جدید"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            فکر یا لحظه‌ای را که نمی‌خواهی فراموش کنی، برای خودت نگه دار.
          </DialogDescription>

          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                صفحه <span className="text-muted-foreground">(اختیاری)</span>
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max={pageCount ?? undefined}
                value={pageNumber}
                onChange={(event) => setPageNumber(event.target.value)}
                placeholder="مثلاً ۲۱۰"
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                یادداشت
              </label>
              <Textarea
                autoFocus
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="فکر، حس یا لحظه‌ی مهمت از این کتاب..."
                className="min-h-28 rounded-xl text-xs leading-relaxed"
              />
            </div>

            <Button
              type="button"
              disabled={saving || !content.trim()}
              onClick={submit}
              className="mt-2 w-full h-9 rounded-xl text-xs font-semibold gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <NotebookPen className="h-3.5 w-3.5" />
              )}
              {editing ? "ذخیره‌ی تغییرات" : "ثبت یادداشت"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Share Note */}
      <Dialog
        open={Boolean(sharing)}
        onOpenChange={(value) => {
          if (!value) setSharing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border/80 bg-card p-5 shadow-xl sm:max-w-md">
          <DialogTitle className="text-base font-bold text-foreground">
            این لحظه منتشر شود؟
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            این متن در صفحه عمومی این کتاب نمایش داده می‌شود. یادداشت اصلی تو
            همچنان خصوصی می‌ماند.
          </DialogDescription>

          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                نوع لحظه
              </label>
              <select
                value={sharedType}
                onChange={(event) => setSharedType(event.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="THOUGHT">فکر</option>
                <option value="QUOTE">نقل‌قول</option>
                <option value="REFLECTION">تأمل</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                صفحه <span className="text-muted-foreground">(اختیاری)</span>
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max={pageCount ?? undefined}
                value={sharedPage}
                onChange={(event) => setSharedPage(event.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                متن قابل انتشار
              </label>
              <Textarea
                autoFocus
                value={sharedContent}
                onChange={(event) => setSharedContent(event.target.value)}
                className="min-h-28 rounded-xl text-xs leading-relaxed"
              />
            </div>

            <Button
              type="button"
              disabled={publishing || !sharedContent.trim()}
              onClick={publish}
              className="mt-2 w-full h-9 rounded-xl text-xs font-semibold gap-1.5"
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Globe2 className="h-3.5 w-3.5" />
              )}
              انتشار در صفحه عمومی
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
