"use client";
import { useMemo, useRef, useState } from "react";
import { FiTwitter } from "@react-icons/all-files/fi/FiTwitter";
import { ImTelegram } from "@react-icons/all-files/im/ImTelegram";
import { ImWhatsapp } from "@react-icons/all-files/im/ImWhatsapp";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

import ProfileShareCard, {
  type ProfileShareCardProps,
} from "@/components/profile/ProfileShareCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  copyToClipboard,
  shareDestinationUrl,
  shareWithDevice,
  supportsNativeShare,
} from "@/lib/share/browser";

type BusyAction = "download" | "share" | null;

const PUBLIC_PROFILE_ORIGIN = "https://qafasehman.ir";

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

function getPublicProfileUrl(username: string) {
  return `${PUBLIC_PROFILE_ORIGIN}/${encodeURIComponent(username)}`;
}

function generateProfileShareText(name: string) {
  return `این قفسه‌ی ${name}ـه! ببین چه کتاب‌هایی خونده، به چی‌ها امتیاز داده و این روزها مسیر مطالعه‌ش چطوری پیش می‌ره.`;
}

function profileShareTextWithUrl(shareText: string, profileUrl: string) {
  return `${shareText}\n\nقفسه‌ش رو اینجا ببین:\n${profileUrl}`;
}

async function waitForCardResources(card: HTMLElement) {
  await document.fonts?.ready;

  const images = Array.from(card.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (card.querySelector('[data-profile-qr="ready"]')) {
      break;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  await waitForPaint();
}

export default function ProfileShare(props: ProfileShareCardProps) {
  const exportRef = useRef<HTMLDivElement>(null);

  const [busy, setBusy] = useState<BusyAction>(null);
  const [copied, setCopied] = useState(false);
  const [hideExportAvatar, setHideExportAvatar] = useState(false);

  const profileUrl = useMemo(
    () => getPublicProfileUrl(props.username),
    [props.username],
  );

  const shareText = useMemo(() => generateProfileShareText(props.name), [props.name]);
  const shareTextWithUrl = useMemo(
    () => profileShareTextWithUrl(shareText, profileUrl),
    [shareText, profileUrl],
  );

  const cardProps = useMemo(
    () => ({
      ...props,
      profileUrl,
      hideAvatar: hideExportAvatar,
    }),
    [props, profileUrl, hideExportAvatar],
  );

  const prepareAvatarForExport = async () => {
    if (!props.avatarUrl) return;

    try {
      const response = await fetch(props.avatarUrl, {
        mode: "cors",
        cache: "force-cache",
      });

      if (!response.ok) {
        throw new Error("AVATAR_UNAVAILABLE");
      }
    } catch {
      setHideExportAvatar(true);
      await waitForPaint();
    }
  };

  const createShareImage = async () => {
    const target = exportRef.current;

    if (!target) {
      throw new Error("PROFILE_SHARE_CARD_NOT_READY");
    }

    await prepareAvatarForExport();
    await waitForCardResources(target);

    const { toBlob } = await import("html-to-image");

    const blob = await toBlob(target, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#101813",
      skipFonts: true,
    });

    if (!blob) {
      throw new Error("PROFILE_SHARE_IMAGE_FAILED");
    }

    return new File([blob], `qafaseh-${props.username}.png`, {
      type: "image/png",
    });
  };

  const downloadImageFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = file.name;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleDownload = async () => {
    try {
      setBusy("download");

      const file = await createShareImage();
      downloadImageFile(file);

      toast.success("تصویر قفسه آماده شد.");
    } catch {
      toast.error("ساخت تصویر با مشکل روبه‌رو شد. دوباره تلاش کنید.");
    } finally {
      setBusy(null);
    }
  };

  const handleNativeShare = async () => {
    try {
      setBusy("share");

      const file = await createShareImage();

      if (!supportsNativeShare()) {
        downloadImageFile(file);
        await copyToClipboard(shareTextWithUrl);
        toast.success("تصویر دانلود شد و متن اشتراک‌گذاری کپی شد.");
        return;
      }

      if (navigator.canShare?.({ files: [file] })) {
        await shareWithDevice({
          title: `قفسه‌ی ${props.name}`,
          text: shareText,
          url: profileUrl,
          files: [file],
        });

        return;
      }

      await shareWithDevice({
        title: `قفسه‌ی ${props.name}`,
        text: shareTextWithUrl,
        url: profileUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast.error("اشتراک‌گذاری با مشکل روبه‌رو شد.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(profileUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
      toast.error("کپی لینک انجام نشد.");
    }
  };

  const openShareDestination = (destination: "telegram" | "whatsapp" | "x") => {
    const destinationUrl = shareDestinationUrl(destination, {
      title: props.name,
      text: shareText,
      url: profileUrl,
    });

    window.open(destinationUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="
            h-9 flex-1 gap-2 rounded-xl border-border/70
            bg-background/70 px-4 text-xs font-bold
            shadow-none transition-colors
            hover:border-primary/30 hover:bg-primary/[0.04]
            sm:flex-initial
          "
        >
          <Share2 className="size-3.5" />
          اشتراک‌گذاری پروفایل
        </Button>
      </DialogTrigger>

      <DialogContent
        dir="rtl"
        className="
          !w-[calc(100vw-1rem)] !max-w-[980px]
          gap-0 overflow-hidden rounded-[24px]
          border border-border/70 bg-background p-0
          shadow-2xl shadow-black/15

          sm:!w-[calc(100vw-2rem)]
          md:!w-[calc(100vw-4rem)]
          md:!max-w-[980px]

          max-sm:bottom-0 max-sm:top-auto
          max-sm:translate-y-0
          max-sm:rounded-b-none max-sm:rounded-t-[24px]
          max-sm:border-b-0
        "
      >
        <DialogHeader
          className="
            border-b border-border/55
            px-5 py-4 text-right sm:px-6
          "
        >
          <div className="flex items-start gap-3">
            <div
              className="
                mt-0.5 flex size-9 shrink-0
                items-center justify-center
                rounded-xl bg-primary/10 text-primary
              "
            >
              <Sparkles className="size-4.5" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base font-black sm:text-lg">
                قفسه‌ات را به اشتراک بگذار
              </DialogTitle>

              <DialogDescription
                className="
                  mt-1 max-w-2xl text-xs leading-5
                  text-muted-foreground sm:text-[13px]
                "
              >
                تصویر آماده برای استوری و پیام‌رسان‌ها بساز یا لینک مستقیم
                پروفایلت را ارسال کن.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          className="
            max-h-[calc(100dvh-92px)]
            overflow-y-auto p-4
            sm:p-5 md:p-6
          "
        >
          <div
            dir="ltr"
            className="
              flex flex-col gap-5
              md:flex-row md:items-stretch md:gap-5
            "
          >
            {/* Preview: takes all remaining space and can never collapse */}
            <section
              dir="rtl"
              className="
                min-w-0 flex-1
                rounded-[22px]
                border border-border/60
                bg-muted/15 p-3
                sm:p-3.5
              "
            >
              <div
                className="
                  mb-3 flex items-center
                  justify-between gap-3
                "
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">
                    پیش‌نمایش تصویر
                  </p>

                  <p className="mt-1 text-[11px] text-muted-foreground">
                    همین تصویر با کیفیت بالا دانلود می‌شود.
                  </p>
                </div>

                <span
                  className="
                    shrink-0 rounded-full
                    border border-border/60
                    bg-background px-2.5 py-1
                    text-[10px] font-bold
                    text-muted-foreground
                  "
                >
                  PNG
                </span>
              </div>

              <div
                className="
                  flex min-h-[320px] w-full
                  items-center justify-center
                  overflow-hidden rounded-[18px]
                  bg-background/40 p-3
                  sm:min-h-[360px]
                "
              >
                <div className="w-full max-w-[560px]">
                  <ProfileShareCard {...cardProps} mode="preview" />
                </div>
              </div>
            </section>

            {/* Actions: fixed width, never steals preview space */}
            <aside
              dir="rtl"
              className="
                w-full shrink-0
                rounded-[22px]
                border border-border/60
                bg-muted/15 p-4
                sm:p-5
                md:w-[330px]
              "
            >
              <div>
                <p className="text-sm font-black text-foreground">
                  خروجی تصویر
                </p>

                <p
                  className="
                    mt-1 text-[11px] leading-5
                    text-muted-foreground
                  "
                >
                  مناسب استوری، اشتراک در پیام‌رسان‌ها و ارسال مستقیم.
                </p>
              </div>

              <div className="mt-4 grid gap-2.5">
                <Button
                  type="button"
                  onClick={handleDownload}
                  disabled={busy !== null}
                  className="
                    h-12 justify-start rounded-xl
                    px-4 font-black shadow-none
                    transition-transform active:scale-[0.99]
                  "
                >
                  {busy === "download" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}

                  <span>
                    {busy === "download"
                      ? "در حال ساخت تصویر..."
                      : "دانلود تصویر"}
                  </span>

                  {busy !== "download" && (
                    <span
                      className="
                        mr-auto rounded-md
                        bg-primary-foreground/10
                        px-2 py-1 text-[9px]
                        font-bold text-primary-foreground/75
                      "
                    >
                      کیفیت بالا
                    </span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleNativeShare}
                  disabled={busy !== null}
                  className="
                    h-12 justify-start rounded-xl
                    border-border/70 bg-background
                    px-4 font-bold shadow-none
                    hover:bg-muted/40
                  "
                >
                  {busy === "share" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Share2 className="size-4" />
                  )}

                  {busy === "share"
                    ? "در حال آماده‌سازی..."
                    : "اشتراک‌گذاری تصویر"}
                </Button>
              </div>

              <div className="my-5 h-px bg-border/50" />

              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-foreground">
                      اشتراک‌گذاری سریع
                    </p>

                    <p className="mt-1 text-[10px] text-muted-foreground">
                      لینک مستقیم پروفایل ارسال می‌شود.
                    </p>
                  </div>

                  <ExternalLink className="mt-0.5 size-3.5 text-muted-foreground/70" />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <ShareAction
                    label="تلگرام"
                    Icon={ImTelegram}
                    iconClassName="text-[#229ED9]"
                    iconBackgroundClassName="bg-[#229ED9]/10"
                    onClick={() => openShareDestination("telegram")}
                  />

                  <ShareAction
                    label="واتس‌اپ"
                    Icon={ImWhatsapp}
                    iconClassName="text-[#25D366]"
                    iconBackgroundClassName="bg-[#25D366]/10"
                    onClick={() => openShareDestination("whatsapp")}
                  />

                  <ShareAction
                    label="X"
                    Icon={FiTwitter}
                    iconClassName="text-foreground"
                    iconBackgroundClassName="bg-foreground/[0.07]"
                    onClick={() => openShareDestination("x")}
                  />
                </div>
              </div>

              <div className="my-5 h-px bg-border/50" />

              <div>
                <p className="text-xs font-black text-foreground">
                  لینک پروفایل
                </p>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`
                    mt-3 flex min-h-12 w-full
                    items-center gap-3 rounded-xl
                    border px-3 py-2.5 text-right
                    transition-colors
                    ${
                      copied
                        ? "border-primary/30 bg-primary/[0.06]"
                        : "border-border/65 bg-background hover:border-primary/25 hover:bg-muted/25"
                    }
                  `}
                >
                  <span
                    className={`
                      flex size-8 shrink-0
                      items-center justify-center rounded-lg
                      ${
                        copied
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }
                    `}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      dir="ltr"
                      className="
                        block truncate text-left
                        text-[11px] font-medium
                        text-foreground/80
                      "
                    >
                      {profileUrl.replace("https://", "")}
                    </span>

                    <span
                      className="
                        mt-0.5 block text-[10px]
                        text-muted-foreground
                      "
                    >
                      {copied ? "لینک کپی شد" : "برای کپی کلیک کن"}
                    </span>
                  </span>

                  <Copy
                    className={`
                      size-3.5 shrink-0
                      ${copied ? "text-primary" : "text-muted-foreground/70"}
                    `}
                  />
                </button>
              </div>
            </aside>
          </div>
        </div>

        {/* Hidden export card */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed left-[-10000px] top-0
          "
        >
          <ProfileShareCard ref={exportRef} {...cardProps} mode="export" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareAction({
  label,
  Icon,
  iconClassName,
  iconBackgroundClassName,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  iconBackgroundClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group flex min-h-[78px]
        flex-col items-center justify-center
        gap-2 rounded-xl border
        border-border/60 bg-background
        px-2 py-3 text-[10px]
        font-bold text-foreground
        transition-all duration-200
        hover:-translate-y-0.5
        hover:border-primary/25
        hover:bg-muted/25
        active:translate-y-0
      "
    >
      <span
        className={`
          flex size-8 items-center
          justify-center rounded-xl
          transition-transform duration-200
          group-hover:scale-105
          ${iconBackgroundClassName}
        `}
      >
        <Icon className={`size-4 ${iconClassName}`} />
      </span>

      {label}
    </button>
  );
}
