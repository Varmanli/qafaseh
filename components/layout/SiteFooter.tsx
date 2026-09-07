import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";
import type { LayoutUser } from "@/components/layout/types";
import type { SiteBranding } from "@/lib/settings/types";

export default function SiteFooter({
  user,
  branding,
}: {
  user?: LayoutUser | null;
  branding: SiteBranding;
}) {
  const footerLinks = [
    { label: "صفحه اصلی", href: "/" },
    { label: "کتاب‌ها", href: "/books" },
    { label: "نویسنده‌ها", href: "/authors" },
    { label: "مجله قفسه", href: "/blog" },
    { label: "درباره قفسه", href: "/about" },
    { label: "تماس با ما", href: "/contact" },
    { label: "قوانین", href: "/terms" },
    { label: "حریم خصوصی", href: "/privacy" },
  ];

  return (
    <footer
      dir="rtl"
      className="
        mt-14
        border-t
        border-border/60
        bg-card/30

        sm:mt-16
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-7xl

          px-4
          py-9

          sm:px-6
          sm:py-11

          lg:px-8
          lg:py-12
        "
      >
        {/* Main footer */}

        <div
          className="
            grid
            gap-8

            md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]
            md:items-start
            md:gap-12

            lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]
            lg:gap-20
          "
        >
          {/* Brand */}

          <div
            className="
              flex
              max-w-lg
              flex-col
              items-center

              text-center

              md:items-start
              md:text-right
            "
          >
            <Link
              href="/"
              aria-label="صفحه اصلی قفسه"
              className="
                inline-flex
                rounded-lg
                outline-none

                focus-visible:ring-2
                focus-visible:ring-primary/30
              "
            >
              <BrandLogo
                logoUrl={branding.logoUrl}
                logoLightUrl={branding.logoLightUrl}
                logoDarkUrl={branding.logoDarkUrl}
                siteName={branding.siteName}
                size="mobile"
              />
            </Link>

            <p
              className="
                mt-4
                max-w-md

                text-xs
                font-medium
                leading-7

                text-muted-foreground

                sm:text-[13px]
                sm:leading-7
              "
            >
              قفسه، یک کتابخانه اجتماعی برای کشف کتاب‌ها، ثبت مطالعه،
              یادداشت‌برداری و به‌اشتراک‌گذاشتن تجربه خواندن است.
            </p>
          </div>

          {/* Navigation */}

          <nav
            aria-label="پیوندهای پایین سایت"
            className="
    w-full

    border-t
    border-border/50

    pt-6

    md:border-t-0
    md:pt-0
  "
          >
            <p
              className="
      mb-4

      text-center
      text-[11px]
      font-black

      text-foreground

      md:text-right
    "
            >
              دسترسی سریع
            </p>

            <div
              className="
      grid
      grid-cols-2

      gap-x-6
      gap-y-3

      min-[440px]:grid-cols-3

      md:grid-cols-3
      md:gap-x-8
      md:gap-y-3.5
    "
            >
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="
          group
          inline-flex
          min-h-8
          items-center

          text-xs
          font-semibold

          text-muted-foreground

          transition-colors
          duration-200

          hover:text-foreground

          focus-visible:rounded-md
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-primary/20
        "
                >
                  <span
                    className="
            transition-transform
            duration-200

            group-hover:-translate-x-0.5
          "
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </nav>
        </div>

        {/* Bottom */}

        <div
          className="
            mt-9

            flex
            flex-col
            items-center

            gap-2.5

            border-t
            border-border/50

            pt-5

            text-center
            text-[10px]
            font-medium
            leading-6

            text-muted-foreground

            sm:text-[11px]

            md:mt-11
            md:flex-row
            md:justify-between
            md:text-right
          "
        >
          <p>© {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date())} {branding.siteName || "قفسه"} — تمامی حقوق محفوظ است.</p>

          <p>ساخته‌شده برای خواندن، یادداشت‌کردن و ساختن یک قفسه شخصی.</p>
        </div>
      </div>
    </footer>
  );
}
