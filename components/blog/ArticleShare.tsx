"use client";

import { useEffect, useState } from "react";
import { ImLinkedin2 } from "@react-icons/all-files/im/ImLinkedin2";
import { ImTelegram } from "@react-icons/all-files/im/ImTelegram";
import { ImWhatsapp } from "@react-icons/all-files/im/ImWhatsapp";
import { FiTwitter } from "@react-icons/all-files/fi/FiTwitter";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import BookCoverImage from "@/components/books/BookCoverImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { copyToClipboard, shareDestinationUrl, shareWithDevice, supportsNativeShare } from "@/lib/share/browser";

type ArticleShareProps = {
  title: string;
  description?: string | null;
  canonicalUrl: string;
  coverImage?: string | null;
  category?: string | null;
  readingTime?: number | null;
};

export default function ArticleShare({
  title,
  description,
  canonicalUrl,
  coverImage,
  category,
  readingTime,
}: ArticleShareProps) {
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareText = description || title;

  useEffect(() => {
    setCanNativeShare(supportsNativeShare());
  }, []);

  const copyLink = async () => {
    try {
      await copyToClipboard(canonicalUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const nativeShare = async () => {
    try {
      await shareWithDevice({ title, text: shareText, url: canonicalUrl });
    } catch {
      // Cancellation is an expected outcome of the native share sheet.
    }
  };

  const openShareUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareActions = [
    {
      label: "تلگرام",
      Icon: ImTelegram,
      href: shareDestinationUrl("telegram", { title, text: shareText, url: canonicalUrl }),
    },
    {
      label: "واتس‌اپ",
      Icon: ImWhatsapp,
      href: shareDestinationUrl("whatsapp", { title, text: shareText, url: canonicalUrl }),
    },
    {
      label: "X",
      Icon: FiTwitter,
      href: shareDestinationUrl("x", { title, text: shareText, url: canonicalUrl }),
    },
    {
      label: "لینکدین",
      Icon: ImLinkedin2,
      href: shareDestinationUrl("linkedin", { title, text: shareText, url: canonicalUrl }),
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-5 text-sm font-black text-foreground backdrop-blur-xl transition-all hover:border-primary/30 hover:text-primary"
        >
          <Share2 className="size-4" />
          اشتراک‌گذاری
        </button>
      </DialogTrigger>

      <DialogContent dir="rtl" className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-border/70 p-0 shadow-none sm:max-w-[640px] max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[calc(100dvh-1rem)] max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-b-0" aria-describedby="article-share-description">
        <DialogHeader className="gap-1 px-5 pt-5 sm:px-6">
          <DialogTitle className="text-base font-black">اشتراک‌گذاری</DialogTitle>
          <DialogDescription id="article-share-description" className="text-xs text-muted-foreground/75">
            این مقاله را با دیگران به اشتراک بگذارید.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          <div className="group flex min-h-32 overflow-hidden rounded-2xl border border-border/70 bg-card/55 sm:min-h-40">
            <div className="relative w-28 shrink-0 overflow-hidden bg-muted sm:w-[38%]">
              <BookCoverImage src={coverImage} alt="" fill sizes="240px" className="object-cover transition duration-200 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-primary">
                {category ? <span>{category}</span> : <span>مجله قفسه</span>}
                {readingTime ? <span className="text-muted-foreground">• {readingTime.toLocaleString("fa-IR")} دقیقه مطالعه</span> : null}
              </div>
              <p className="mt-2 line-clamp-3 text-sm font-black leading-6 text-foreground sm:text-base sm:leading-7">{title}</p>
              <p className="mt-auto pt-3 text-[11px] font-bold text-muted-foreground">قفسه</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {canNativeShare ? (
              <ShareAction label="سایر برنامه‌ها" Icon={Share2} onClick={nativeShare} />
            ) : null}
            {shareActions.map(({ label, Icon, href }) => (
              <ShareAction key={label} label={label} Icon={Icon} onClick={() => openShareUrl(href)} />
            ))}
          </div>

          <div className="mt-5">
            <label htmlFor="article-share-url" className="text-xs font-bold text-muted-foreground">لینک مقاله</label>
            <div className="mt-2 flex items-center gap-2" dir="ltr">
              <Input id="article-share-url" readOnly value={canonicalUrl} className="h-9 min-w-0 flex-1 border-border/60 bg-muted/35 text-left text-[11px] text-muted-foreground" />
              <Button type="button" variant="outline" size="sm" onClick={copyLink} className={`h-9 shrink-0 transition-colors ${copied ? "border-primary/35 bg-primary/10 text-primary" : "border-border/70"}`}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span dir="rtl">{copied ? "کپی شد" : "کپی لینک"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareAction({
  label,
  Icon,
  onClick,
  success = false,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  success?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={`group flex h-11 items-center gap-2 rounded-xl border bg-background/35 px-3 text-right text-xs font-bold transition duration-200 hover:-translate-y-px hover:border-primary/35 hover:bg-primary/5 ${success ? "border-primary/35 text-primary" : "border-border/70 text-foreground"}`}>
      <Icon className="size-4 shrink-0 text-primary transition-transform duration-200 group-hover:scale-110" />
      <span className="min-w-0 truncate">{success ? "کپی شد" : label}</span>
    </button>
  );
}
