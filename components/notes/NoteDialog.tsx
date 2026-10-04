"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import RichTextEditor from "@/components/content/RichTextEditor";
import type { PublicNote } from "@/lib/notes/service";
import { richTextToPlainText } from "@/lib/content/rich-text";

export default function NoteDialog({
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
