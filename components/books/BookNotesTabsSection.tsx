"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import RichTextEditor from "@/components/content/RichTextEditor";
import NoteCard from "@/components/profile/NoteCard";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import type { PublicNote } from "@/lib/notes/service";
import { richTextToPlainText } from "@/lib/content/rich-text";

export default function BookNotesTabsSection({
  catalogBookId,
  selectedEditionId,
  isLoggedIn,
  bookNotes,
  bookNotesCount = bookNotes.length,
  editionNotes,
  editionNotesCount = editionNotes.length,
  viewerId,
  viewAllHref,
  editionNotesHref,
  loginHref,
  title = "خواننده‌ها درباره این کتاب چه نوشته‌اند؟",
  flat = false,
}: {
  catalogBookId: string;
  selectedEditionId: string | null;
  isLoggedIn: boolean;
  bookNotes: PublicNote[];
  bookNotesCount?: number;
  editionNotes: PublicNote[];
  editionNotesCount?: number;
  viewerId: string | null;
  viewAllHref?: string;
  editionNotesHref?: string;
  loginHref?: string;
  title?: string;
  flat?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicNote | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const scopedNotes = bookNotes.slice(0, 3);
  const hasNotes = scopedNotes.length > 0;
  const scope = editing?.scope ?? "book";

  function openAdd() {
    setEditing(null);
    setContent("");
    setOpen(true);
  }

  function openEdit(note: PublicNote) {
    setEditing(note);
    setContent(note.content);
    setOpen(true);
  }

  async function submit() {
    const text = content.trim();
    if (!richTextToPlainText(text) || busy) return;

    setBusy(true);
    try {
      if (editing) {
        const res = await fetch(`/api/notes/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });

        if (!res.ok) throw new Error((await res.json()).error || "خطا");
        toast.success("یادداشت بروزرسانی شد");
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            catalogBookId,
            bookEditionId: scope === "edition" ? selectedEditionId : null,
            scope,
            content: text,
          }),
        });

        if (!res.ok) throw new Error((await res.json()).error || "خطا");
        toast.success("یادداشت منتشر شد");
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await confirm({
      title: "حذف یادداشت",
      description: "این یادداشت حذف شود؟ این عملیات قابل بازگشت نیست.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error((await res.json()).error || "خطا");
          toast.success("یادداشت حذف شد.");
          router.refresh();
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "حذف یادداشت ناموفق بود.",
          );
        }
      },
    });
  }

  return (
    <section className={cn("relative", !flat && "border-t border-border/40 py-6 sm:py-8", flat && "px-1")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          {title}
          <span className="mr-2 text-xs font-medium text-muted-foreground">
            {bookNotesCount.toLocaleString("fa-IR")} یادداشت
          </span>
        </h2>
        <div className="flex items-center gap-4">
          {hasNotes && viewAllHref ? (
            <Link href={viewAllHref} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary">
              مشاهده همه <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          {isLoggedIn && hasNotes ? (
            <Button type="button" onClick={openAdd} data-onboarding="book-public-note" className="h-9 rounded-full px-3 text-xs font-bold">
              <Plus className="h-4 w-4" /> افزودن یادداشت
            </Button>
          ) : null}
        </div>
      </div>
      {selectedEditionId && editionNotesHref ? (
        <Link href={editionNotesHref} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          یادداشت‌های این نسخه ({editionNotesCount.toLocaleString("fa-IR")})
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      ) : null}

      <div className="mt-4 max-w-4xl">
        {!hasNotes ? (
          <EmptyNotesState isLoggedIn={isLoggedIn} onAdd={openAdd} scope="book" loginHref={loginHref} />
        ) : (
          scopedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              canLike={isLoggedIn}
              showAuthor
              showBook={false}
              editorial
              overflowActions
              manage={viewerId && note.authorUserId === viewerId ? {
                onEdit: () => openEdit(note),
                onDelete: () => remove(note.id),
              } : undefined}
            />
          ))
        )}
      </div>

      <NoteDialog
        open={open}
        editing={editing}
        content={content}
        busy={busy}
        scope={scope}
        onOpenChange={setOpen}
        onContentChange={setContent}
        onSubmit={submit}
      />
    </section>
  );
}

function EmptyNotesState({
  isLoggedIn,
  onAdd,
  scope,
  loginHref,
}: {
  isLoggedIn: boolean;
  onAdd: () => void;
  scope: "book" | "edition";
  loginHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 py-4">
      <p className="text-sm text-muted-foreground">
        {scope === "edition"
          ? "هنوز یادداشتی درباره این نسخه منتشر نشده است."
          : "هنوز یادداشتی درباره این کتاب منتشر نشده است."}
      </p>
      {isLoggedIn ? (
        <Button type="button" onClick={onAdd} className="h-9 rounded-full px-3 text-xs font-bold">
          <Plus className="h-4 w-4" /> افزودن یادداشت
        </Button>
      ) : loginHref ? (
        <Link href={loginHref} className="text-xs font-semibold text-primary hover:underline">
          ورود برای نوشتن یادداشت
        </Link>
      ) : null}
    </div>
  );
}

function NoteDialog({
  open,
  editing,
  content,
  busy,
  scope,
  onOpenChange,
  onContentChange,
  onSubmit,
}: {
  open: boolean;
  editing: PublicNote | null;
  content: string;
  busy: boolean;
  scope: "book" | "edition";
  onOpenChange: (open: boolean) => void;
  onContentChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const scopeLabel = scope === "edition" ? "این نسخه" : "خود کتاب";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-cols-none flex-col gap-0 overflow-hidden rounded-none border-border bg-card p-0 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:w-[min(860px,calc(100vw-48px))] sm:max-w-[860px] sm:rounded-[1.75rem]"
      >
        <div className="relative shrink-0 border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300 ring-1 ring-sky-300/20">
              <Sparkles className="h-5 w-5" />
            </span>

            <div className="min-w-0 pl-8">
              <DialogTitle className="text-base font-black text-foreground">
                {editing ? "ویرایش یادداشت" : "افزودن یادداشت"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-6 text-muted-foreground">
                {editing
                  ? "یادداشت عمومی روی صفحه کتاب و پروفایل تو دیده می‌شود."
                  : `این یادداشت برای «${scopeLabel}» ثبت می‌شود و روی صفحه کتاب و پروفایل تو دیده می‌شود.`}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-5">
          {!editing ? (
            <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3 text-xs font-bold text-muted-foreground">
              ثبت یادداشت برای:{" "}
              <span className="text-foreground">{scopeLabel}</span>
            </div>
          ) : null}

          <RichTextEditor
            variant="note"
            value={content}
            onChange={onContentChange}
            placeholder={
              scope === "edition"
                ? "برداشتت از این نسخه یا ترجمه..."
                : "برداشتت از خود کتاب..."
            }
            ariaLabel={editing ? "متن ویرایش یادداشت" : "متن یادداشت جدید"}
            className="min-h-0 flex-1"
          />

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 pt-3 sm:pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="h-10 rounded-xl px-4 text-foreground hover:bg-white/[0.05]"
            >
              بستن
            </Button>

            <Button
              type="button"
              onClick={onSubmit}
              disabled={busy || !richTextToPlainText(content)}
              className="h-10 rounded-xl px-4 font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editing ? "ذخیره" : "انتشار"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
