"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CornerDownLeft, MessageCircle, Send, X } from "lucide-react";
import toast from "react-hot-toast";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getLoginPath } from "@/lib/auth/routes";
import { COMMENT_MAX_LENGTH, type CommentItem, type CommentPage, type SocialCommentTarget } from "@/lib/social/comment-contract";

type Props = { targetType: SocialCommentTarget; targetId: string; canComment: boolean; defaultOpen?: boolean; showToggle?: boolean; standalone?: boolean };
type ReplyPage = CommentPage & { loaded: boolean; open: boolean };
type DeletedComment = { id: string; parentId: string | null; deletedCount: number };

async function commentRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  let data: T & { error?: string };
  try { data = await response.json(); }
  catch { throw new Error("ارتباط با سرور برقرار نشد؛ دوباره تلاش کن"); }
  if (!response.ok) throw new Error(data.error || "دریافت یا ثبت دیدگاه ناموفق بود");
  return data;
}

function mergeComments(previous: CommentItem[], incoming: CommentItem[], replies = false) {
  const byId = new Map(previous.map((comment) => [comment.id, comment]));
  for (const comment of incoming) byId.set(comment.id, comment);
  return [...byId.values()].sort((a, b) => {
    const order = a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    return replies ? order : -order;
  });
}

export default function CommentsSection(props: Props) {
  return <CommentsPanel key={`${props.targetType}:${props.targetId}`} {...props} />;
}

function CommentsPanel({ targetType, targetId, canComment, defaultOpen = false, showToggle = true, standalone = false }: Props) {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [page, setPage] = useState<CommentPage | null>(null);
  const [replyPages, setReplyPages] = useState<Record<string, ReplyPage>>({});
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const lastLoad = useRef<{ parentId?: string; cursor?: string }>({});

  const loadPage = useCallback(async (parentId?: string, cursor?: string) => {
    if (controller.current || busyRef.current) return;
    const requestController = new AbortController();
    controller.current = requestController;
    lastLoad.current = { parentId, cursor };
    setLoading(parentId || "roots");
    setError(null);
    try {
      const query = new URLSearchParams({ targetType, targetId, ...(parentId ? { parentId } : {}), ...(cursor ? { cursor } : {}) });
      const result = await commentRequest<CommentPage>(`/api/comments?${query}`, { signal: requestController.signal });
      if (requestController.signal.aborted) return;
      if (parentId) {
        setReplyPages((previous) => ({ ...previous, [parentId]: {
          ...result, loaded: true, open: true,
          comments: mergeComments(previous[parentId]?.comments ?? [], result.comments, true),
        } }));
      } else {
        setPage((previous) => ({ ...result,
          totalCount: result.totalCount ?? previous?.totalCount ?? 0,
          comments: cursor ? mergeComments(previous?.comments ?? [], result.comments) : result.comments,
        }));
        if (!cursor) {
          setReplyPages({});
          setReplyTo((previous) => result.comments.some((comment) => comment.id === previous?.id) ? previous : null);
        }
      }
    } catch (cause) {
      if (!requestController.signal.aborted) setError(cause instanceof Error ? cause.message : "دریافت دیدگاه‌ها ناموفق بود");
    } finally {
      if (controller.current === requestController) {
        controller.current = null;
        setLoading(null);
      }
    }
  }, [targetType, targetId]);

  useEffect(() => {
    if (defaultOpen) void loadPage();
    return () => {
      const active = controller.current;
      controller.current = null;
      active?.abort();
    };
  }, [defaultOpen, loadPage]);

  function changeBusy(value: boolean) {
    busyRef.current = value;
    setBusy(value);
  }

  function toggleOpen() {
    setOpen((previous) => !previous);
    if (!open) void loadPage();
  }

  function startReply(comment: CommentItem) {
    if (busyRef.current) return;
    setReplyTo(comment);
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function onCreated(comment: CommentItem) {
    const parentId = comment.parentId;
    if (parentId) {
      setReplyPages((previous) => ({ ...previous, [parentId]: {
        comments: mergeComments(previous[parentId]?.comments ?? [], [comment], true),
        nextCursor: previous[parentId]?.nextCursor ?? null,
        loaded: previous[parentId]?.loaded ?? false,
        open: true,
      } }));
      setPage((previous) => previous ? { ...previous,
        totalCount: (previous.totalCount ?? 0) + 1,
        comments: previous.comments.map((root) => root.id === parentId ? { ...root, replyCount: root.replyCount + 1 } : root),
      } : previous);
    } else {
      setPage((previous) => previous ? { ...previous,
        totalCount: (previous.totalCount ?? 0) + 1,
        comments: mergeComments(previous.comments, [comment]),
      } : { comments: [comment], nextCursor: null, totalCount: 1 });
    }
    setReplyTo(null);
  }

  async function manageComment(comment: CommentItem, content?: string) {
    if (busyRef.current || controller.current) return false;
    if (content === undefined && !window.confirm(comment.parentId ? "این پاسخ حذف شود؟" : "این دیدگاه و پاسخ‌های آن حذف شوند؟")) return false;
    changeBusy(true);
    try {
      if (content !== undefined) {
        const result = await commentRequest<{ comment: CommentItem }>(`/api/comments/${comment.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
        });
        setPage((previous) => previous ? { ...previous, comments: previous.comments.map((item) => item.id === comment.id ? result.comment : item) } : previous);
        if (comment.parentId) setReplyPages((previous) => ({ ...previous, [comment.parentId!]: { ...previous[comment.parentId!],
          comments: previous[comment.parentId!].comments.map((item) => item.id === comment.id ? result.comment : item),
        } }));
      } else {
        const result = await commentRequest<DeletedComment>(`/api/comments/${comment.id}`, { method: "DELETE" });
        setPage((previous) => previous ? { ...previous,
          totalCount: Math.max(0, (previous.totalCount ?? 0) - result.deletedCount),
          comments: previous.comments.filter((item) => item.id !== result.id).map((item) => item.id === result.parentId ? { ...item, replyCount: Math.max(0, item.replyCount - 1) } : item),
        } : previous);
        setReplyPages((previous) => {
          const next = { ...previous };
          if (result.parentId && next[result.parentId]) next[result.parentId] = { ...next[result.parentId], comments: next[result.parentId].comments.filter((item) => item.id !== result.id) };
          else delete next[result.id];
          return next;
        });
        setReplyTo((previous) => previous?.id === result.id ? null : previous);
      }
      return true;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تغییر دیدگاه ناموفق بود");
      return false;
    } finally { changeBusy(false); }
  }

  async function toggleReplies(comment: CommentItem) {
    const thread = replyPages[comment.id];
    if (thread?.open) setReplyPages((previous) => ({ ...previous, [comment.id]: { ...previous[comment.id], open: false } }));
    else if (thread?.loaded) setReplyPages((previous) => ({ ...previous, [comment.id]: { ...previous[comment.id], open: true } }));
    else await loadPage(comment.id);
  }

  return (
    <section aria-label="دیدگاه‌ها" className={standalone ? "mt-0 pt-0" : "mt-4 border-t border-border/50 pt-3"}>
      {showToggle ? (
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={toggleOpen} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
          <MessageCircle className="size-4" aria-hidden="true" />
          دیدگاه‌ها{page ? ` (${(page.totalCount ?? 0).toLocaleString("fa-IR")})` : ""}
        </button>
      ) : null}
      <div id={panelId} hidden={!open}>
        <div className="mt-4 space-y-4">
          {error ? <p role="alert" className="rounded-xl bg-destructive/5 px-3 py-2 text-xs leading-6 text-destructive">{error}<button type="button" disabled={!!loading || busy} onClick={() => void loadPage(lastLoad.current.parentId, lastLoad.current.cursor)} className="ms-2 underline">دوباره تلاش کن</button></p> : null}
          {loading === "roots" ? <p role="status" className="animate-pulse py-3 text-center text-xs text-muted-foreground">در حال دریافت دیدگاه‌ها…</p> : null}
          {page && canComment ? <CommentComposer targetType={targetType} targetId={targetId} replyTo={replyTo} textareaRef={textareaRef} disabled={!!loading || busy} onBusyChange={changeBusy} onCreated={onCreated} onCancelReply={() => setReplyTo(null)} /> : null}
          {!canComment ? <Link href={getLoginPath(pathname)} className="inline-block py-2 text-xs font-semibold text-primary">برای نوشتن دیدگاه وارد شو</Link> : null}
          {page?.totalCount === 0 ? <div className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground"><MessageCircle className="size-4 text-primary/60" aria-hidden="true" /><p>هنوز دیدگاهی ثبت نشده؛ تو اولین نفر باش.</p></div> : null}
          {page?.comments.map((comment) => {
            const thread = replyPages[comment.id];
            return <div key={comment.id} className="space-y-2.5">
              <CommentRow comment={comment} disabled={busy || !!loading} onReply={canComment ? () => startReply(comment) : undefined} onManage={manageComment} />
              {comment.replyCount > 0 ? <button type="button" disabled={!!loading || busy} aria-expanded={!!thread?.open} aria-controls={`${panelId}-${comment.id}-replies`} onClick={() => void toggleReplies(comment)} className="ms-11 inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><CornerDownLeft className="size-3.5" aria-hidden="true" />{loading === comment.id ? "در حال دریافت پاسخ‌ها…" : thread?.open ? "بستن پاسخ‌ها" : `نمایش پاسخ‌ها (${comment.replyCount.toLocaleString("fa-IR")})`}</button> : null}
              {thread?.open ? <div id={`${panelId}-${comment.id}-replies`} className="ms-4 space-y-3 border-s-2 border-primary/20 ps-3 sm:ms-6">
                {thread.comments.map((reply) => <CommentRow key={reply.id} comment={reply} disabled={busy || !!loading} onManage={manageComment} />)}
                {!thread.loaded || thread.nextCursor ? <button type="button" disabled={!!loading || busy} onClick={() => void loadPage(comment.id, thread.loaded ? thread.nextCursor ?? undefined : undefined)} className="min-h-8 text-[11px] font-semibold text-primary disabled:opacity-50">{loading === comment.id ? "در حال دریافت…" : "پاسخ‌های بیشتر"}</button> : null}
              </div> : null}
            </div>;
          })}
          {page?.nextCursor ? <Button variant="ghost" size="sm" disabled={!!loading || busy} onClick={() => void loadPage(undefined, page.nextCursor ?? undefined)} className="w-full text-xs text-muted-foreground">دیدگاه‌های بیشتر</Button> : null}
        </div>
      </div>
    </section>
  );
}

function CommentComposer({ targetType, targetId, replyTo, textareaRef, disabled, onBusyChange, onCreated, onCancelReply }: {
  targetType: SocialCommentTarget; targetId: string; replyTo: CommentItem | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>; disabled: boolean;
  onBusyChange: (value: boolean) => void; onCreated: (comment: CommentItem) => void; onCancelReply: () => void;
}) {
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const retry = useRef<{ snapshot: string; requestId: string } | null>(null);
  const inputId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || sending.current || disabled) return;
    sending.current = true;
    setPending(true);
    onBusyChange(true);
    setError(null);
    const payload = { targetType, targetId, content: content.trim(), ...(replyTo ? { parentId: replyTo.id } : {}) };
    const snapshot = JSON.stringify(payload);
    if (retry.current?.snapshot !== snapshot) retry.current = { snapshot, requestId: crypto.randomUUID() };
    try {
      const result = await commentRequest<{ comment: CommentItem }>("/api/comments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, requestId: retry.current.requestId }),
      });
      onCreated(result.comment);
      setContent("");
      retry.current = null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ثبت دیدگاه ناموفق بود"); }
    finally { sending.current = false; setPending(false); onBusyChange(false); }
  }

  return <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-border/60 bg-background/30 transition-shadow focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
    {replyTo ? <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-primary/5 px-3 text-xs text-muted-foreground"><span className="inline-flex min-w-0 items-center gap-1.5"><CornerDownLeft className="size-3.5 shrink-0" aria-hidden="true" />پاسخ به {replyTo.authorName || replyTo.authorUsername || "کاربر"}</span><button type="button" disabled={pending} onClick={onCancelReply} aria-label="لغو پاسخ" className="flex size-8 shrink-0 items-center justify-center rounded-full hover:text-foreground"><X className="size-4" /></button></div> : null}
    <label className="sr-only" htmlFor={inputId}>{replyTo ? "متن پاسخ" : "متن دیدگاه"}</label>
    <textarea id={inputId} ref={textareaRef} value={content} onChange={(event) => setContent(event.target.value)} disabled={pending} maxLength={COMMENT_MAX_LENGTH} rows={3} dir="rtl" placeholder={replyTo ? "پاسخت را بنویس…" : "دیدگاهت را بنویس…"} aria-describedby={error ? `${inputId}-error` : undefined} className="block min-h-28 w-full resize-y border-0 bg-transparent px-3.5 py-3 text-right text-sm leading-7 outline-none placeholder:text-muted-foreground/65 disabled:opacity-60" />
    {error ? <p id={`${inputId}-error`} role="alert" className="px-3.5 pb-2 text-xs leading-6 text-destructive">{error} متن دیدگاهت حفظ شده است.</p> : null}
    <div className="flex items-center justify-between gap-3 border-t border-border/40 px-3 py-2"><span dir="ltr" className="text-[10px] tabular-nums text-muted-foreground/65">{content.length ? `${content.length.toLocaleString("fa-IR")} / ${COMMENT_MAX_LENGTH.toLocaleString("fa-IR")}` : ""}</span><Button type="submit" size="sm" disabled={disabled || pending || !content.trim()} className="h-9 gap-1.5 rounded-xl px-3 text-xs font-semibold"><Send className="size-3.5" aria-hidden="true" />{pending ? "در حال ثبت…" : replyTo ? "ثبت پاسخ" : "ثبت دیدگاه"}</Button></div>
  </form>;
}

function CommentRow({ comment, disabled, onReply, onManage }: { comment: CommentItem; disabled: boolean; onReply?: () => void; onManage: (comment: CommentItem, content?: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const author = comment.authorName?.trim() || comment.authorUsername || "کاربر";
  const profileHref = comment.authorUsername ? `/${encodeURIComponent(comment.authorUsername)}` : null;
  const inputId = useId();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onManage(comment, draft)) setEditing(false);
  }

  return <div className="flex items-start gap-2.5">
    <Avatar className="mt-1 size-8 shrink-0 ring-1 ring-border/50">
      {comment.authorImage ? <AvatarImage src={comment.authorImage} alt={author} loading="lazy" /> : null}
      <AvatarFallback className="bg-surface-3 text-[11px] text-primary-deep">{author.charAt(0)}</AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1 rounded-2xl border border-border/40 bg-background/25 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 leading-6"><strong className="text-xs font-bold text-foreground sm:text-[13px]">{profileHref ? <Link href={profileHref} prefetch={false} className="transition-colors hover:text-primary">{author}</Link> : author}</strong><time dateTime={comment.createdAt} className="text-[10px] text-muted-foreground/70">{new Date(comment.createdAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}</time></div>
      {editing ? <form onSubmit={save} className="mt-2 space-y-2">
        <label className="sr-only" htmlFor={inputId}>ویرایش دیدگاه</label>
        <textarea id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={disabled} maxLength={COMMENT_MAX_LENGTH} rows={2} dir="rtl" autoFocus className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-right text-sm leading-6 focus:outline-primary" />
        <div className="flex gap-3"><Button type="submit" size="sm" disabled={disabled || !draft.trim()} className="h-8 text-xs">ذخیره</Button><button type="button" disabled={disabled} onClick={() => setEditing(false)} className="text-xs text-muted-foreground">انصراف</button></div>
      </form> : <p dir="auto" className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90 [overflow-wrap:anywhere]">{comment.content}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[10px] text-muted-foreground/75">
        {comment.updatedAt !== comment.createdAt ? <span>ویرایش‌شده</span> : null}
        {onReply ? <button type="button" disabled={disabled} onClick={onReply} className="min-h-8 text-[11px] font-semibold hover:text-primary disabled:opacity-50">پاسخ</button> : null}
        {comment.canEdit && !editing ? <button type="button" disabled={disabled} onClick={() => { setDraft(comment.content); setEditing(true); }} className="min-h-8 text-[11px] hover:text-primary disabled:opacity-50">ویرایش</button> : null}
        {comment.canDelete ? <button type="button" disabled={disabled} onClick={() => void onManage(comment)} className="min-h-8 text-[11px] hover:text-destructive disabled:opacity-50">حذف</button> : null}
      </div>
    </div>
  </div>;
}
