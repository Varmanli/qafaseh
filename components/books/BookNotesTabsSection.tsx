"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  MessageSquareText,
  NotebookPen,
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

type NoteTab = "book" | "edition";

export default function BookNotesTabsSection({
  catalogBookId,
  selectedEditionId,
  isLoggedIn,
  bookNotes,
  editionNotes,
  viewerId,
  viewAllHref,
  loginHref,
  title = "یادداشت‌های کاربران درباره کتاب",
  editionSummary,
  flat = false,
}: {
  catalogBookId: string;
  selectedEditionId: string | null;
  isLoggedIn: boolean;
  bookNotes: PublicNote[];
  editionNotes: PublicNote[];
  viewerId: string | null;
  viewAllHref?: string;
  loginHref?: string;
  title?: string;
  editionSummary?: {
    label?: string | null;
    publisher?: string | null;
    translator?: string | null;
    publishedYear?: number | null;
  } | null;
  flat?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicNote | null>(null);
  const [activeTab, setActiveTab] = useState<NoteTab>("book");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const hasEditionTab = Boolean(selectedEditionId);

  useEffect(() => {
    if (!hasEditionTab && activeTab === "edition") {
      setActiveTab("book");
    }
  }, [activeTab, hasEditionTab]);

  const scopedNotes = activeTab === "edition" ? editionNotes : bookNotes;
  const hasNotes = scopedNotes.length > 0;
  const isExpandable = scopedNotes.length > 2;
  const scope: NoteTab =
    editing?.scope ??
    (activeTab === "edition" && hasEditionTab ? "edition" : "book");

  function openAdd() {
    setEditing(null);
    setContent("");
    setOpen(true);
  }

  function openEdit(note: PublicNote) {
    setEditing(note);
    setActiveTab(note.scope);
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
    <section className={cn("relative", !flat ? "overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-md transition-all hover:border-border/80 sm:p-5" : "px-1")}>
      <div>
        <div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <NotebookPen className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground sm:text-lg">
                    {title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {(activeTab === "edition"
                        ? editionNotes.length
                        : bookNotes.length
                      ).toLocaleString("fa-IR")}{" "}
                      یادداشت
                    </span>

                    {viewAllHref ? (
                      <Link
                        href={viewAllHref}
                        className={cn(
                          "inline-flex items-center justify-center rounded-lg border text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary shrink-0",
                          flat ? "h-6 bg-background/20 border-border/50 px-2.5" : "h-6 border-border/60 bg-background/50 px-2.5"
                        )}
                      >
                        مشاهده کامل
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              {isLoggedIn ? (
                <Button
                  type="button"
                  onClick={openAdd}
                  data-onboarding="book-public-note"
                  className="h-9 shrink-0 rounded-xl px-3 text-xs font-bold sm:px-4 sm:text-sm"
                >
                  <Plus className="h-4 w-4" />
                  افزودن یادداشت
                </Button>
              ) : loginHref ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-9 shrink-0 rounded-xl border-border/60 bg-background/50 px-3 text-xs font-bold sm:px-4 sm:text-sm"
                >
                  <Link href={loginHref}>
                    ورود برای یادداشت‌گذاشتن
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
              <TabButton
                active={activeTab === "book"}
                onClick={() => setActiveTab("book")}
                label="یادداشت‌های کتاب"
                count={bookNotes.length}
              />

              {hasEditionTab ? (
                <TabButton
                  active={activeTab === "edition"}
                  onClick={() => setActiveTab("edition")}
                  label="یادداشت‌های این نسخه"
                  count={editionNotes.length}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {activeTab === "edition" && editionSummary ? (
            <EditionContextSummary summary={editionSummary} />
          ) : null}

          {!hasNotes ? (
            <EmptyNotesState
              isLoggedIn={isLoggedIn}
              onAdd={openAdd}
              scope={activeTab}
              loginHref={loginHref}
            />
          ) : (
            <>
              <div
                onClickCapture={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest("[data-note-expand-toggle]")
                  ) {
                    setIsExpanded(true);
                  }
                }}
                className={cn(
                  "relative grid grid-cols-1 gap-4 transition-all duration-300",
                  isExpandable && !isExpanded
                    ? "max-h-[31rem] overflow-hidden"
                    : "max-h-none overflow-visible",
                )}
              >
                {scopedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    canLike={isLoggedIn}
                    showAuthor
                    showBook={false}
                    manage={
                      viewerId && note.authorUserId === viewerId
                        ? {
                            onEdit: () => openEdit(note),
                            onDelete: () => remove(note.id),
                          }
                        : undefined
                    }
                  />
                ))}
                {isExpandable && !isExpanded ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/90 via-card/50 to-transparent" />
                ) : null}
              </div>

              {isExpandable ? (
                <div className="mt-3 border-t border-border/30 pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    aria-expanded={isExpanded}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    {isExpanded ? "نمایش کمتر" : "بیشتر بخوانید"}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
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

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-right text-xs font-medium transition-colors sm:text-sm",
        active
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 rounded-full border border-current/15 px-2 py-0.5 text-[10px] tabular-nums sm:text-[11px]">
        {count.toLocaleString("fa-IR")}
      </span>
    </button>
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
  scope: NoteTab;
  loginHref?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border/50 bg-background/30 px-4 py-7 text-center">
      <div className="relative">
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <MessageSquareText className="h-4 w-4" />
        </div>

        <p className="mt-3 text-xs font-medium text-foreground sm:text-sm">
          {scope === "edition"
            ? "هنوز یادداشتی درباره این نسخه منتشر نشده"
            : "هنوز یادداشتی درباره کتاب منتشر نشده"}
        </p>

        <p className="mx-auto mt-1.5 max-w-md text-xs leading-6 text-muted-foreground">
          {isLoggedIn
            ? scope === "edition"
              ? "اولین برداشت عمومی از این نسخه یا ترجمه را بنویس."
              : "اولین برداشت عمومی از خود کتاب را بنویس."
            : scope === "edition"
              ? "هنوز خواننده‌ای برای این نسخه یادداشت منتشر نکرده است."
              : "هنوز خواننده‌ای برای این کتاب یادداشت منتشر نکرده است."}
        </p>

        {isLoggedIn ? (
          <Button
            type="button"
            onClick={onAdd}
            className="mt-4 h-9 rounded-xl px-4 text-xs font-bold sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            افزودن اولین یادداشت
          </Button>
        ) : loginHref ? (
          <Button
            asChild
            variant="outline"
            className="mt-4 h-9 rounded-xl border-border/60 bg-background/50 px-4 text-xs font-bold sm:text-sm"
          >
            <Link href={loginHref}>ورود برای نوشتن یادداشت</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EditionContextSummary({
  summary,
}: {
  summary: {
    label?: string | null;
    publisher?: string | null;
    translator?: string | null;
    publishedYear?: number | null;
  };
}) {
  const items = [
    summary.label,
    summary.publisher,
    summary.translator ? `ترجمه ${summary.translator}` : null,
    summary.publishedYear != null
      ? summary.publishedYear.toLocaleString("fa-IR")
      : null,
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-background/30 px-4 py-3 text-xs leading-6 text-muted-foreground sm:text-sm">
      <span className="font-bold text-foreground">نسخه انتخاب‌شده:</span>{" "}
      {items.join(" • ")}
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
  scope: NoteTab;
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
