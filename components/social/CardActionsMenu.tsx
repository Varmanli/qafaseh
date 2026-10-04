"use client";

import { useRef, useState } from "react";
import { Check, Copy, MoreVertical, Pencil, Share2, Trash2, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ContentEditButton from "@/components/social/ContentEditButton";
import type { PublicQuote } from "@/lib/quotes/service";
import type { PublicNote } from "@/lib/notes/service";
import type { CardManage } from "@/components/profile/QuoteCard";

export default function CardActionsMenu({ quote, note, copied, canCopy = true, onCopy, onShare, manage }: {
  quote?: PublicQuote;
  note?: PublicNote;
  copied?: boolean;
  canCopy?: boolean;
  onCopy: () => void;
  onShare: () => void;
  manage?: CardManage;
}) {
  const [open, setOpen] = useState(false);
  const openingEditor = useRef(false);
  const itemClass = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-right text-sm font-medium text-foreground transition-colors hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40";

  function renderMenu(onEdit?: () => void) {
    function run(action: () => void, editing = false) {
      openingEditor.current = editing;
      setOpen(false);
      action();
    }
    return (
      <div className="contents" onClick={(event) => event.stopPropagation()}>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button type="button" aria-label="عملیات کارت" title="عملیات کارت" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/30 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><MoreVertical className="size-4" aria-hidden="true" /></button>
          </SheetTrigger>
          <SheetContent side="bottom" hideClose dir="rtl" onCloseAutoFocus={(event) => { if (openingEditor.current) event.preventDefault(); openingEditor.current = false; }} className="inset-x-3 bottom-3 mx-auto max-w-sm gap-3 rounded-3xl border border-border/70 bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 px-2">
              <SheetTitle className="text-sm font-bold">عملیات {note ? "یادداشت" : "تکهٔ کتاب"}</SheetTitle>
              <SheetClose asChild><button type="button" aria-label="بستن منو" className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden="true" /></button></SheetClose>
            </div>
            <SheetDescription className="sr-only">کپی، اشتراک‌گذاری و مدیریت محتوا</SheetDescription>
            <div className="space-y-1 border-t border-border/40 pt-2">
              <button type="button" disabled={!canCopy} onClick={() => run(onCopy)} className={itemClass}>{copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copied ? "کپی شد" : "کپی متن"}</button>
              <button type="button" onClick={() => run(onShare)} className={itemClass}><Share2 className="size-4" aria-hidden="true" />اشتراک‌گذاری</button>
              {onEdit ? <button type="button" onClick={() => run(onEdit, true)} className={itemClass}><Pencil className="size-4" aria-hidden="true" />ویرایش</button> : null}
              {manage ? <button type="button" onClick={() => run(manage.onDelete)} className={`${itemClass} text-destructive hover:bg-destructive/5`}><Trash2 className="size-4" aria-hidden="true" />حذف</button> : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Keep the editor outside the sheet so closing the menu preserves its dialog.
  if (!manage && quote?.canEdit) return <ContentEditButton quote={quote} renderTrigger={renderMenu} />;
  if (!manage && note?.canEdit) return <ContentEditButton note={note} renderTrigger={renderMenu} />;
  return renderMenu(manage?.onEdit);
}
