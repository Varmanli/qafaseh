"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Mail, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { AdminActionButton, AdminBadge, AdminDataTable, AdminDataTableActions, AdminDataTableCell, AdminDataTablePagination, AdminDataTableRow, AdminDataTableSearch } from "@/components/admin/AdminDataTable";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Topic = "book" | "criticism" | "suggestion" | "problem" | "cooperation" | "other";
type ContactMessage = {
  id: string;
  name: string;
  email: string;
  topic: Topic;
  message: string;
  bookTitle: string | null;
  bookAuthor: string | null;
  bookTranslator: string | null;
  bookReference: string | null;
  isRead: boolean;
  createdAt: string;
};

const topicLabels: Record<Topic, string> = {
  book: "پیشنهاد کتاب",
  criticism: "انتقاد",
  suggestion: "پیشنهاد و ایده",
  problem: "گزارش مشکل",
  cooperation: "همکاری",
  other: "موضوع دیگر",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "درخواست ناموفق بود.";
    throw new Error(message);
  }
  if (!data || typeof data !== "object") throw new Error("پاسخ سرور نامعتبر است.");
  return data as T;
}

export default function ContactMessagesManager() {
  const confirm = useConfirm();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), status });
      if (q.trim()) params.set("q", q.trim());
      if (topic) params.set("topic", topic);
      const response = await fetch(`/api/admin/contact-messages?${params}`, { cache: "no-store" });
      const data = await readResponse<{ messages: ContactMessage[]; total: number; unreadTotal: number; totalPages: number }>(response);
      setMessages(data.messages);
      setTotal(data.total);
      setUnreadTotal(data.unreadTotal);
      setTotalPages(data.totalPages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری پیام‌ها ناموفق بود");
    } finally {
      setLoading(false);
    }
  }, [page, q, status, topic]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  useEffect(() => setPage(1), [q, topic, status]);

  async function openMessage(message: ContactMessage) {
    setSelected(message);
    if (message.isRead) return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, isRead: true } : item));
    setUnreadTotal((current) => Math.max(0, current - 1));
    try {
      await readResponse(await fetch(`/api/admin/contact-messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "وضعیت پیام ذخیره نشد");
    }
  }

  function removeMessage(message: ContactMessage) {
    void confirm({
      title: "حذف پیام",
      description: `پیام «${topicLabels[message.topic]}» از ${message.name} حذف شود؟ این کار قابل بازگشت نیست.`,
      onConfirm: async () => {
        try {
          await readResponse(await fetch(`/api/admin/contact-messages/${message.id}`, { method: "DELETE" }));
          setSelected((current) => current?.id === message.id ? null : current);
          toast.success("پیام حذف شد.");
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "حذف پیام ناموفق بود");
          throw error;
        }
      },
    });
  }

  return <div dir="rtl" className="space-y-5">
    <AdminPageHeader title="پیام‌های تماس" description={`${total.toLocaleString("fa-IR")} پیام در این فهرست · ${unreadTotal.toLocaleString("fa-IR")} پیام خوانده‌نشده`} />

    <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/50 p-3 sm:grid-cols-[minmax(0,1fr)_190px_160px] sm:p-4">
      <AdminDataTableSearch value={q} onChange={setQ} placeholder="جست‌وجوی نام، ایمیل، متن یا کتاب..." className="sm:min-w-0 [&_input]:h-10 [&_input]:rounded-xl [&_input]:bg-background/70 [&_input]:shadow-none [&_span]:h-7 [&_span]:w-7 [&_span]:rounded-lg" />
      <select aria-label="موضوع پیام" value={topic} onChange={(event) => setTopic(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background/70 px-3 text-sm"><option value="">همهٔ موضوع‌ها</option>{Object.entries(topicLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="وضعیت خواندن" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-border/70 bg-background/70 px-3 text-sm"><option value="all">همهٔ پیام‌ها</option><option value="unread">خوانده‌نشده</option><option value="read">خوانده‌شده</option></select>
    </div>

    <AdminDataTable
      columns={[{ key: "status", label: "وضعیت" }, { key: "topic", label: "موضوع" }, { key: "sender", label: "فرستنده", align: "start" }, { key: "message", label: "پیام", align: "start" }, { key: "date", label: "زمان" }, { key: "actions", label: "عملیات" }]}
      loading={loading}
      isEmpty={!messages.length}
      emptyText={q || topic || status !== "all" ? "پیامی با این فیلترها پیدا نشد." : "هنوز پیامی دریافت نشده است."}
      minWidth={920}
      footer={<AdminDataTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    >
      {messages.map((message) => <AdminDataTableRow key={message.id} className={!message.isRead ? "bg-primary/[0.025]" : undefined}>
        <AdminDataTableCell><AdminBadge className={!message.isRead ? "border-primary/20 bg-primary/10 text-primary" : "border-border/60 bg-background/45 text-muted-foreground"}>{!message.isRead ? "جدید" : "خوانده‌شده"}</AdminBadge></AdminDataTableCell>
        <AdminDataTableCell><AdminBadge>{topicLabels[message.topic]}</AdminBadge></AdminDataTableCell>
        <AdminDataTableCell align="start"><div className="max-w-44"><span className="block truncate font-bold">{message.name}</span><span dir="ltr" className="block truncate text-xs text-white/55">{message.email}</span></div></AdminDataTableCell>
        <AdminDataTableCell align="start"><p className="line-clamp-2 max-w-80 break-words text-xs leading-6 text-white/75">{message.topic === "book" && message.bookTitle ? `کتاب: ${message.bookTitle} · ` : ""}{message.message}</p></AdminDataTableCell>
        <AdminDataTableCell><span className="whitespace-nowrap text-xs">{formatDate(message.createdAt)}</span></AdminDataTableCell>
        <AdminDataTableCell><AdminDataTableActions><AdminActionButton icon={<Eye className="h-4 w-4" />} title="مشاهده پیام" onClick={() => void openMessage(message)} /><AdminActionButton icon={<Trash2 className="h-4 w-4" />} title="حذف پیام" tone="danger" onClick={() => removeMessage(message)} /></AdminDataTableActions></AdminDataTableCell>
      </AdminDataTableRow>)}
    </AdminDataTable>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent dir="rtl" className="max-h-[calc(100dvh-32px)] overflow-y-auto sm:max-w-2xl">
        {selected && <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="size-5 text-primary" />{topicLabels[selected.topic]}</DialogTitle>
            <DialogDescription>{selected.name} · {formatDate(selected.createdAt)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">نام: </span>{selected.name}</p>
            <p><span className="text-muted-foreground">ایمیل: </span><a dir="ltr" className="text-primary hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a></p>
          </div>
          {selected.topic === "book" && <section className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
            <h3 className="mb-3 text-sm font-bold">مشخصات کتاب پیشنهادی</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2"><p>عنوان: {selected.bookTitle || "—"}</p><p>نویسنده: {selected.bookAuthor || "—"}</p><p>مترجم: {selected.bookTranslator || "—"}</p><p>شابک یا لینک: {selected.bookReference || "—"}</p></div>
          </section>}
          <section className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <h3 className="mb-2 text-xs font-bold text-muted-foreground">متن پیام</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-8">{selected.message}</p>
          </section>
          <DialogFooter><Button variant="outline" asChild><a href={`mailto:${selected.email}?subject=${encodeURIComponent(`پیام قفسه: ${topicLabels[selected.topic]}`)}`}>پاسخ با ایمیل</a></Button><Button variant="destructive" onClick={() => removeMessage(selected)}>حذف پیام</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
