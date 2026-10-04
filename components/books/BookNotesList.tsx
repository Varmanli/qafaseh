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
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import NoteDialog from "@/components/notes/NoteDialog";
import NoteCard from "@/components/profile/NoteCard";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import type { PublicNote } from "@/lib/notes/service";
import { richTextToPlainText } from "@/lib/content/rich-text";

type NoteTab = "book" | "edition";

export default function BookNotesList({
  catalogBookId,
  selectedEditionId,
  isLoggedIn,
  initialBookNotes,
  initialEditionNotes,
  initialBookHasMore,
  initialEditionHasMore,
  viewerId,
  loginHref,
  editionSummary,
}: {
  catalogBookId: string;
  selectedEditionId: string | null;
  isLoggedIn: boolean;
  initialBookNotes: PublicNote[];
  initialEditionNotes: PublicNote[];
  initialBookHasMore: boolean;
  initialEditionHasMore: boolean;
  viewerId: string | null;
  loginHref?: string;
  editionSummary?: {
    label?: string | null;
    publisher?: string | null;
    translator?: string | null;
    publishedYear?: number | null;
  } | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicNote | null>(null);
  const [activeTab, setActiveTab] = useState<NoteTab>("book");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const [bookNotes, setBookNotes] = useState(initialBookNotes);
  const [editionNotes, setEditionNotes] = useState(initialEditionNotes);
  const [bookHasMore, setBookHasMore] = useState(initialBookHasMore);
  const [editionHasMore, setEditionHasMore] = useState(initialEditionHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasEditionTab = Boolean(selectedEditionId);

  useEffect(() => {
    setBookNotes(initialBookNotes);
  }, [initialBookNotes]);

  useEffect(() => {
    setEditionNotes(initialEditionNotes);
  }, [initialEditionNotes]);

  useEffect(() => {
    setBookHasMore(initialBookHasMore);
  }, [initialBookHasMore]);

  useEffect(() => {
    setEditionHasMore(initialEditionHasMore);
  }, [initialEditionHasMore]);

  useEffect(() => {
    if (!hasEditionTab && activeTab === "edition") {
      setActiveTab("book");
    }
  }, [activeTab, hasEditionTab]);

  const scopedNotes = activeTab === "edition" ? editionNotes : bookNotes;
  const hasMore = activeTab === "edition" ? editionHasMore : bookHasMore;
  const hasNotes = scopedNotes.length > 0;
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

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const offset = scopedNotes.length;
    try {
      const url = `/api/books/${encodeURIComponent(
        catalogBookId,
      )}/notes?scope=${activeTab}&offset=${offset}&limit=10${
        selectedEditionId ? `&edition=${encodeURIComponent(selectedEditionId)}` : ""
      }`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok || !data.notes) {
        throw new Error();
      }

      if (activeTab === "edition") {
        setEditionNotes((current) => [
          ...current,
          ...data.notes.filter(
            (item: PublicNote) => !current.some((old) => old.id === item.id),
          ),
        ]);
        setEditionHasMore(Boolean(data.hasMore));
      } else {
        setBookNotes((current) => [
          ...current,
          ...data.notes.filter(
            (item: PublicNote) => !current.some((old) => old.id === item.id),
          ),
        ]);
        setBookHasMore(Boolean(data.hasMore));
      }
    } catch {
      // Ignore
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" dir="rtl">
      {/* Header controls & Tab switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-md">
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

        {isLoggedIn ? (
          <Button
            type="button"
            onClick={openAdd}
            className="h-9 shrink-0 rounded-xl px-4 text-xs font-bold gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            افزودن یادداشت
          </Button>
        ) : loginHref ? (
          <Button
            asChild
            variant="outline"
            className="h-9 shrink-0 rounded-xl border-border/60 bg-background/50 px-4 text-xs font-bold gap-1.5 self-start sm:self-auto"
          >
            <Link href={loginHref}>
              ورود برای یادداشت‌گذاشتن
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <div>
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
          <div className="space-y-8">
            <div className="flex flex-col gap-6">
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
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="h-10 rounded-full border border-border/60 bg-background/30 px-6 text-xs font-bold text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-primary gap-2 cursor-pointer transition-colors"
                >
                  {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  مشاهده بیشتر
                </Button>
              </div>
            )}
          </div>
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
    </div>
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
        "inline-flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-right text-xs font-medium transition-colors sm:text-sm cursor-pointer",
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
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/50 bg-background/30 px-4 py-8 text-center">
      <div className="relative">
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <MessageSquareText className="h-4 w-4" />
        </div>

        <p className="mt-3 text-xs font-bold text-foreground sm:text-sm">
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
            className="mt-4 h-9 rounded-xl px-4 text-xs font-bold gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            افزودن اولین یادداشت
          </Button>
        ) : loginHref ? (
          <Button
            asChild
            variant="outline"
            className="mt-4 h-9 rounded-xl border-border/60 bg-background/50 px-4 text-xs font-bold cursor-pointer"
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
