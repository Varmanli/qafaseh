import { forwardRef, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  BookOpen,
  CheckCircle2,
  LibraryBig,
  Link as LinkIcon,
  Sparkles,
  Star,
} from "lucide-react";

export type ProfileShareCardProps = {
  name: string;
  username: string;
  avatarUrl?: string | null;
  readCount: number;
  readingCount: number;
  wantToReadCount: number;
  averageRating?: number | null;
  profileUrl: string;
  hideAvatar?: boolean;
  mode?: "preview" | "export";
};

const ProfileShareCard = forwardRef<HTMLDivElement, ProfileShareCardProps>(
  function ProfileShareCard(
    {
      name,
      username,
      avatarUrl,
      readCount,
      readingCount,
      wantToReadCount,
      averageRating,
      profileUrl,
      hideAvatar = false,
      mode = "preview",
    },
    ref,
  ) {
    const [qrDataUrl, setQrDataUrl] = useState("");
    const [avatarFailed, setAvatarFailed] = useState(false);

    const initial = (name.trim().charAt(0) || "ق").toUpperCase();
    const readableUrl = profileUrl.replace(/^https?:\/\//, "");
    const showAvatar = Boolean(avatarUrl) && !avatarFailed && !hideAvatar;

    useEffect(() => {
      let active = true;

      QRCode.toDataURL(profileUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: "#111814",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((dataUrl) => {
          if (active) setQrDataUrl(dataUrl);
        })
        .catch(() => {
          if (active) setQrDataUrl("");
        });

      return () => {
        active = false;
      };
    }, [profileUrl]);

    const stats = useMemo(
      () => [
        {
          value: readCount,
          label: "کتاب‌هایی که خوندم",
          Icon: CheckCircle2,
          icon: "text-[#b6d8be]",
          iconBg: "bg-[#b6d8be]/10",
        },
        {
          value: readingCount,
          label: "کتاب‌هایی که دارم می‌خونم",
          Icon: BookOpen,
          icon: "text-[#e6bd77]",
          iconBg: "bg-[#e6bd77]/10",
        },
        {
          value: wantToReadCount,
          label: "کتاب‌هایی که می‌خوام بخونم",
          Icon: LibraryBig,
          icon: "text-[#b6cadb]",
          iconBg: "bg-[#b6cadb]/10",
        },
        ...(averageRating != null
          ? [
              {
                value: averageRating,
                label: "میانگین امتیاز کتاب‌هام",
                Icon: Star,
                fraction: true,
                icon: "text-[#e5cc85]",
                iconBg: "bg-[#e5cc85]/10",
              },
            ]
          : []),
      ],
      [averageRating, readCount, readingCount, wantToReadCount],
    );
    return (
      <section
        ref={ref}
        dir="rtl"
        className={`
          relative overflow-hidden
          [container-type:inline-size]
          rounded-[1.8rem]
          border border-white/[0.07]
          bg-[#0b110d]
          text-[#f6f2e8]
          ${
            mode === "export"
              ? "h-[675px] w-[540px] min-h-[675px] min-w-[540px] max-h-[675px] max-w-[540px]"
              : "aspect-[4/5] w-full"
          }
        `}
      >
        {/* Background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/library.webp"
          alt=""
          aria-hidden="true"
          className="
            absolute inset-0 size-full
            object-cover object-[63%_center]
            opacity-[0.19]
            saturate-[0.72]
          "
        />

        <div className="absolute inset-0 bg-[#09100c]/78" />

        <div
          className="
            absolute inset-0
            bg-[linear-gradient(180deg,rgba(11,17,13,0.12)_0%,rgba(9,14,11,0.48)_56%,rgba(7,11,8,0.9)_100%)]
          "
        />

        <div
          className="
            absolute inset-0
            bg-[radial-gradient(circle_at_88%_7%,rgba(169,212,179,0.14),transparent_27%),radial-gradient(circle_at_8%_88%,rgba(214,166,82,0.08),transparent_30%)]
          "
        />

        <div className="relative flex h-full flex-col p-[5.6%]">
          {/* Brand */}
          <div className="flex items-center justify-between">
            <div
              className="
                inline-flex items-center gap-[1.4cqw]
                rounded-full border border-white/[0.065]
                bg-white/[0.035]
                px-[2.4cqw] py-[1cqw]
                text-[1.95cqw] font-black
                text-[#b6d8be]
              "
            >
              <Sparkles className="size-[2.45cqw]" />
              قفسه
            </div>

            <span className="text-[1.65cqw] font-bold tracking-[0.08em] text-white/28">
              QAFASEH
            </span>
          </div>

          {/* Hero */}
          <div className="mt-[4.1%]">
            <h2
              className="
                text-[6.1cqw] font-black
                leading-[1.12] tracking-[-0.04em]
              "
            >
              این <span className="text-[#b6d8be]">قفسه‌ی منه.</span>
            </h2>

            <p
              className="
                mt-[2%] max-w-[89%]
                text-[2.25cqw] leading-[1.7]
                text-white/54
              "
            >
              کتاب‌هایی که خوندم و چیزهایی که می‌خوام بخونم، همه اینجان.
            </p>
          </div>

          {/* Profile */}
          <div className="mt-[3.9%] flex items-center gap-[3%]">
            <div
              className="
                relative flex size-[12.3cqw] shrink-0
                items-center justify-center overflow-hidden
                rounded-[3.7cqw]
                border border-[#b6d8be]/25
                bg-[#203428]
                text-[4.1cqw] font-black
                text-[#f6f2e8]
                shadow-[0_8px_22px_rgba(0,0,0,0.22)]
              "
            >
              <div
                aria-hidden="true"
                className="
                  absolute inset-0
                  bg-[linear-gradient(145deg,rgba(255,255,255,0.09),transparent_55%)]
                "
              />

              {showAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl ?? undefined}
                  alt=""
                  crossOrigin="anonymous"
                  onError={() => setAvatarFailed(true)}
                  className="relative size-full object-cover"
                />
              ) : (
                <span className="relative">{initial}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-col items-start gap-[0.55cqw]">
                <h3 className="w-full truncate text-[3.6cqw] font-black leading-tight">
                  {name}
                </h3>

                <p
                  dir="ltr"
                  className="
                    w-full truncate text-right
                    text-[2.05cqw] font-medium
                    text-white/38
                "
                >
                  @{username}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div
            className={`
    mt-[3.9%] grid gap-[2%]
    ${stats.length === 4 ? "grid-cols-2" : "grid-cols-3"}
  `}
          >
            {stats.map(({ value, label, Icon, fraction, icon, iconBg }) => (
              <div
                key={label}
                className="
          relative overflow-hidden
          rounded-[1.15rem]
          border border-white/[0.075]
          bg-white/[0.045]
          px-[4.2%] py-[4%]
        "
              >
                {/* subtle top highlight */}
                <div
                  aria-hidden="true"
                  className="
            pointer-events-none
            absolute inset-x-[10%] top-0 h-px
            bg-gradient-to-r
            from-transparent via-white/10 to-transparent
          "
                />

                {/* icon + label */}
                <div className="flex items-center gap-[2cqw]">
                  <span
                    className={`
              flex size-[5.4cqw] shrink-0
              items-center justify-center
              rounded-[1.55cqw]
              ${iconBg}
            `}
                  >
                    <Icon className={`size-[2.9cqw] ${icon}`} />
                  </span>

                  <p
                    className="
              min-w-0 truncate
              text-[2.25cqw] font-bold
              leading-none text-white/68
            "
                  >
                    {label}
                  </p>
                </div>

                {/* value */}
                {/* value */}
                <div className="mt-[4.3%] flex items-end justify-center gap-[1.2cqw]">
                  <p
                    className="
      text-[6.2cqw] font-black
      leading-[0.9]
      tracking-[-0.035em]
      text-[#f8f4e9]
      tabular-nums
      text-center
    "
                  >
                    {Number(value).toLocaleString("fa-IR", {
                      maximumFractionDigits: fraction ? 1 : 0,
                    })}
                  </p>

                  {fraction && (
                    <span
                      className="
        mb-[0.35cqw]
        text-[1.8cqw] font-bold
        text-white/30
      "
                    >
                      از ۱۰
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            className="
              mt-auto
              border-t border-white/[0.065]
              pt-[3.5%]
            "
          >
            <div
              className="
                flex items-center gap-[3.6%]
                rounded-[1.15rem]
                border border-white/[0.055]
                bg-black/15
                p-[2.8%]
              "
            >
              <div
                data-profile-qr={qrDataUrl ? "ready" : "pending"}
                className="
                  shrink-0 overflow-hidden
                  rounded-[0.85rem]
                  bg-white p-[1.35%]
                "
              >
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="کد QR پروفایل"
                    className="size-[13.9cqw]"
                  />
                ) : (
                  <div className="size-[13.9cqw]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[2.95cqw] font-black">قفسه‌م رو ببین</p>

                <p
                  className="
                    mt-[1.4%]
                    text-[1.9cqw] leading-[1.55]
                    text-white/46
                  "
                >
                  QR رو اسکن کن یا لینک رو باز کن.
                </p>

                <div
                  dir="ltr"
                  className="
                    mt-[2.2%] flex min-w-0
                    items-center gap-[1.2cqw]
                    rounded-[0.75rem]
                    bg-[#b6d8be]/[0.07]
                    px-[1.9cqw] py-[1.2cqw]
                    text-left
                  "
                >
                  <LinkIcon className="size-[2.15cqw] shrink-0 text-[#b6d8be]" />

                  <span
                    className="
                      truncate text-[1.85cqw]
                      font-bold text-[#b6d8be]
                    "
                  >
                    {readableUrl}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-[2.4%] flex items-center justify-between gap-3 px-[0.4%]">
              <p className="text-[1.8cqw] font-medium text-white/30">
                کتاب‌هات، یک‌جا و مرتب.
              </p>

              <p className="shrink-0 text-[1.85cqw] font-black text-[#b6d8be]">
                qafasehman.ir
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  },
);

ProfileShareCard.displayName = "ProfileShareCard";

export default ProfileShareCard;
