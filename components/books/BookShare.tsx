"use client";

import { useEffect, useMemo, useState } from "react";
import { FiTwitter } from "@react-icons/all-files/fi/FiTwitter";
import { ImLinkedin2 } from "@react-icons/all-files/im/ImLinkedin2";
import { ImTelegram } from "@react-icons/all-files/im/ImTelegram";
import { ImWhatsapp } from "@react-icons/all-files/im/ImWhatsapp";
import { BookOpen, Check, Copy, Plus, Share2 } from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BookStatus } from "@/lib/book/detail-service";
import { copyToClipboard, shareDestinationUrl, shareWithDevice, supportsNativeShare } from "@/lib/share/browser";

type BookShareProps = {
  title: string;
  originalTitle?: string | null;
  author: string;
  translator?: string | null;
  coverImage?: string | null;
  canonicalUrl: string;
  status?: BookStatus | null;
  rating?: number | null;
};

export default function BookShare(props: BookShareProps) {
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [note, setNote] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const shareText = useMemo(() => buildShareText(props, note), [props, note]);

  useEffect(() => {
    setCanNativeShare(supportsNativeShare());
  }, []);

  const copy = async (value: string, success: (value: boolean) => void) => {
    try {
      await copyToClipboard(value);
      success(true);
      window.setTimeout(() => success(false), 2000);
    } catch {
      success(false);
    }
  };

  const share = async () => {
    try {
      await shareWithDevice({ title: props.title, text: shareText, url: props.canonicalUrl });
    } catch {
      // Native-share cancellation is a normal user action.
    }
  };

  const actions = [
    { label: "تلگرام", Icon: ImTelegram, href: shareDestinationUrl("telegram", { title: props.title, text: shareText, url: props.canonicalUrl }) },
    { label: "واتس‌اپ", Icon: ImWhatsapp, href: shareDestinationUrl("whatsapp", { title: props.title, text: shareText, url: props.canonicalUrl }) },
    { label: "X", Icon: FiTwitter, href: shareDestinationUrl("x", { title: props.title, text: shareText, url: props.canonicalUrl }) },
    { label: "لینکدین", Icon: ImLinkedin2, href: shareDestinationUrl("linkedin", { title: props.title, text: shareText, url: props.canonicalUrl }) },
  ];
  const status = getStatus(props.status);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="group flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/55 px-4 text-sm font-black text-foreground transition-all hover:border-primary/35 hover:bg-primary/5 hover:text-primary">
          <span className="inline-flex items-center gap-2"><Share2 className="size-4" /> اشتراک‌گذاری</span>
          <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">معرفی کتاب</span>
        </button>
      </DialogTrigger>

      <DialogContent dir="rtl" className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-border/70 p-0 shadow-none sm:max-w-[640px] max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[calc(100dvh-1rem)] max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-b-0">
        <DialogHeader className="gap-1 px-5 pt-5 sm:px-6">
          <DialogTitle className="text-base font-black">اشتراک‌گذاری کتاب</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/75">آنچه می‌خوانید را با دیگران به اشتراک بگذارید.</DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          <BookShareCard {...props} status={status} />

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="book-share-note" className="text-xs font-bold text-muted-foreground">یادداشت برای اشتراک‌گذاری <span className="font-medium">(اختیاری)</span></label>
              <span className="text-[10px] tabular-nums text-muted-foreground/65">{note.length.toLocaleString("fa-IR")} / ۱۸۰</span>
            </div>
            <Textarea id="book-share-note" value={note} maxLength={180} onChange={(event) => setNote(event.target.value)} placeholder="چیزی درباره این کتاب بنویس..." className="mt-2 min-h-[76px] resize-none rounded-xl border-border/60 bg-background/35 px-3.5 py-2.5 text-right text-sm leading-6 placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-primary/20" />
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">این یادداشت همراه مشخصات کتاب و لینک قفسه به اشتراک گذاشته می‌شود.</p>
            <Button type="button" onClick={() => copy(recommendationText(shareText, props.canonicalUrl), setCopiedText)} className={`mt-3 h-11 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground transition-colors hover:bg-primary/90 ${copiedText ? "bg-primary/85" : ""}`}>
              {copiedText ? <Check className="size-4" /> : <Copy className="size-4" />}{copiedText ? "متن آماده اشتراک‌گذاری کپی شد" : "اشتراک‌گذاری با یادداشت من"}
            </Button>
          </div>

          <div className="mt-5">
            <p className="mb-2.5 text-[11px] font-bold text-muted-foreground">اشتراک‌گذاری مستقیم</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {canNativeShare ? <ShareAction label="سایر برنامه‌ها" Icon={Share2} onClick={share} /> : null}
            {actions.map(({ label, Icon, href }) => <ShareAction key={label} label={label} Icon={Icon} onClick={() => window.open(href, "_blank", "noopener,noreferrer")} />)}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="book-share-link" className="text-xs font-bold text-muted-foreground">لینک کتاب</label>
            <div className="mt-2 flex items-center gap-2" dir="ltr">
              <Input id="book-share-link" readOnly value={props.canonicalUrl} className="h-8 min-w-0 flex-1 border-border/50 bg-muted/20 text-left text-[10px] text-muted-foreground/75" />
              <Button type="button" variant="outline" size="sm" onClick={() => copy(props.canonicalUrl, setCopiedLink)} className={`h-8 shrink-0 text-xs ${copiedLink ? "border-primary/35 bg-primary/10 text-primary" : "border-border/60"}`}>
                {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}<span dir="rtl">{copiedLink ? "کپی شد" : "کپی لینک"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BookShareCard({ title, originalTitle, author, translator, coverImage, status, rating }: Omit<BookShareProps, "status"> & { status: ReturnType<typeof getStatus> }) {
  const StatusIcon = status.icon;
  return <section className="flex min-h-48 overflow-hidden rounded-2xl border border-border/70 bg-card/55">
    <div className="relative w-36 shrink-0 overflow-hidden bg-muted sm:w-[40%]"><BookCoverImage src={coverImage} alt="" fill sizes="260px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" /></div>
    <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
      <p className="text-[11px] font-bold text-muted-foreground">قفسه</p>
      <h3 className="mt-2.5 line-clamp-2 text-base font-black leading-7 text-foreground">{title}</h3>
      {originalTitle ? <p dir="ltr" className="mt-1 line-clamp-1 text-xs font-medium text-muted-foreground">{originalTitle}</p> : null}
      <p className="mt-2 text-sm font-bold text-foreground/85">{author}</p>
      {translator ? <p className="mt-1 text-xs text-muted-foreground">ترجمه {translator}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3"><span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary"><StatusIcon className="size-3.5" />{status.label}</span>{rating ? <span className="text-[11px] font-bold text-muted-foreground">امتیاز من: {rating.toLocaleString("fa-IR")} از ۱۰</span> : null}</div>
    </div>
  </section>;
}

function getStatus(status?: BookStatus | null) {
  if (status === "READING") return { label: "در حال خواندن", icon: BookOpen };
  if (status === "FINISHED") return { label: "خوانده‌شده", icon: Check };
  if (status === "UNREAD") return { label: "می‌خواهم بخوانم", icon: Plus };
  return { label: "این کتاب را در قفسه ببینید", icon: BookOpen };
}

function buildShareText({ title, author, status, rating }: BookShareProps, note: string) {
  const subject = `«${title}» اثر ${author}`;
  let text = status === "READING" ? `دارم ${subject} را می‌خوانم.` : status === "FINISHED" ? `${subject} را خواندم${rating ? ` و به آن ${rating.toLocaleString("fa-IR")} از ۱۰ دادم` : ""}.` : status === "UNREAD" ? `${subject} را به فهرست کتاب‌هایی که می‌خواهم بخوانم اضافه کردم.` : `کتاب ${subject} را در قفسه ببینید.`;
  if (note.trim()) text = `${note.trim()}\n\n${text}`;
  return text;
}

function recommendationText(shareText: string, canonicalUrl: string) {
  return `${shareText}\n\nصفحه کتاب در قفسه: ${canonicalUrl}`;
}

function ShareAction({ label, Icon, onClick }: { label: string; Icon: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex h-11 items-center gap-2 rounded-xl border border-border/70 bg-background/35 px-3 text-right text-xs font-bold text-foreground transition duration-200 hover:-translate-y-px hover:border-primary/35 hover:bg-primary/5"><Icon className="size-4 shrink-0 text-primary transition-transform duration-200 group-hover:scale-110" /><span className="min-w-0 truncate">{label}</span></button>;
}
