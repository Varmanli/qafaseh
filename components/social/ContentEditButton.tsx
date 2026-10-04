"use client";

import { useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import toast from "react-hot-toast";

import type { PublicQuote } from "@/lib/quotes/service";
import type { PublicNote } from "@/lib/notes/service";
import { QUOTE_BACKGROUNDS } from "@/lib/quotes/backgrounds";
import { normalizeMediaUrl } from "@/lib/book/cover";
import { richTextToPlainText } from "@/lib/content/rich-text";
import { notifyContentEdited } from "./useEditedContent";

const QuoteDialog = dynamic(() => import("@/components/quotes/QuoteDialog"));
const NoteDialog = dynamic(() => import("@/components/notes/NoteDialog"));
type Props = ({ quote: PublicQuote; note?: never } | { note: PublicNote; quote?: never }) & { renderTrigger?: (startEditing: () => void) => ReactNode };

export default function ContentEditButton({ quote, note, renderTrigger }: Props) {
  const item = quote || note;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [content, setContent] = useState("");
  const [page, setPage] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [background, setBackground] = useState("default");
  const [backgrounds, setBackgrounds] = useState<Array<{ value: string; label: string }>>([...QUOTE_BACKGROUNDS]);
  const unsavedImages = useRef(new Set<string>());

  async function cleanupImage(key: string) {
    unsavedImages.current.delete(key);
    try {
      await fetch("/api/upload/image", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    } catch { /* The upload endpoint also protects attached images. */ }
  }

  function changeImage(nextKey: string) {
    if (imageKey && imageKey !== nextKey && unsavedImages.current.has(imageKey)) void cleanupImage(imageKey);
    if (nextKey && nextKey !== quote?.imageKey) unsavedImages.current.add(nextKey);
    setImageKey(nextKey || null);
  }

  function changeOpen(nextOpen: boolean) {
    if (busy || uploading) return;
    if (!nextOpen) for (const key of unsavedImages.current) void cleanupImage(key);
    setOpen(nextOpen);
  }

  function startEditing() {
    setContent(item.content);
    if (quote) {
      setPage(quote.page ? String(quote.page) : "");
      setImageKey(quote.imageKey);
      setImagePreview(normalizeMediaUrl(quote.imageKey));
      setBackground(quote.background);
      void fetch("/api/quotes/backgrounds")
        .then((response) => response.ok ? response.json() : null)
        .then((data) => { if (Array.isArray(data?.backgrounds) && data.backgrounds.length) setBackgrounds(data.backgrounds); })
        .catch(() => undefined);
    }
    setOpen(true);
  }

  async function save() {
    if (busy || uploading) return;
    if (quote ? !content.trim() && !imageKey : !richTextToPlainText(content)) return;
    const normalizedPage = page ? Number(page) : null;
    if (quote && normalizedPage !== null && (!Number.isSafeInteger(normalizedPage) || normalizedPage <= 0)) {
      toast.error("شمارهٔ صفحه باید عددی مثبت باشد");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/${quote ? "quotes" : "notes"}/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quote ? { content: content.trim(), page: normalizedPage, imageKey, background } : { content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ذخیرهٔ تغییرات انجام نشد");
      if (quote) {
        const saved = result.quote;
        unsavedImages.current.delete(saved.imageKey);
        for (const key of unsavedImages.current) void cleanupImage(key);
        notifyContentEdited("QUOTE", item.id, { content: saved.content, imageKey: saved.imageKey, page: saved.page, background: saved.background });
      } else {
        notifyContentEdited("NOTE", item.id, { content: result.note.content });
      }
      setOpen(false);
      toast.success("تغییرات ذخیره شد");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیرهٔ تغییرات انجام نشد");
    } finally { setBusy(false); }
  }

  if (!item.canEdit) return null;
  return (
    <div className="contents" onClick={(event) => event.stopPropagation()}>
      {renderTrigger ? renderTrigger(startEditing) : <button type="button" aria-label={quote ? "ویرایش تکه کتاب" : "ویرایش یادداشت"} title="ویرایش" onClick={(event) => { event.stopPropagation(); startEditing(); }} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
        <Pencil className="size-4" aria-hidden="true" />
      </button>}
      {open && (quote ? (
        <QuoteDialog open={open} editing={quote} content={content} page={page} busy={busy} imageKey={imageKey} imagePreview={imagePreview} uploading={uploading} background={background} backgroundsList={backgrounds} onOpenChange={changeOpen} onContentChange={setContent} onPageChange={setPage} onImagePreviewChange={(value) => setImagePreview(value || null)} onImageKeyChange={changeImage} onUploadStateChange={setUploading} onBackgroundChange={setBackground} onSubmit={save} />
      ) : (
        <NoteDialog open={open} editing={note} content={content} busy={busy} scope={note.scope} onOpenChange={changeOpen} onContentChange={setContent} onSubmit={save} />
      ))}
    </div>
  );
}
