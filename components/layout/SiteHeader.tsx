"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Search } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import type { LayoutUser } from "@/components/layout/types";
import UserMenu from "@/components/layout/UserMenu";
import SearchComponent from "@/components/SearchComponent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getPrimaryNav } from "@/lib/layout/navigation";
import type { SiteBranding } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

export type HeaderUser = LayoutUser;

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({
  logoUrl,
  logoLightUrl,
  logoDarkUrl,
  siteName,
  compact = false,
}: {
  logoUrl: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  siteName: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label={`صفحه اصلی ${siteName}`}
      className="
        group flex min-w-0 shrink-0 items-center
        rounded-xl outline-none
        focus-visible:ring-2 focus-visible:ring-primary/40
        focus-visible:ring-offset-2 focus-visible:ring-offset-background
      "
    >
      <BrandLogo
        logoUrl={logoUrl}
        logoLightUrl={logoLightUrl}
        logoDarkUrl={logoDarkUrl}
        siteName={siteName}
        size={compact ? "mobile" : "header"}
        nameClassName="
          transition-colors duration-200
          group-hover:text-primary
        "
      />
    </Link>
  );
}

function MobileSearchDialog({
  searchResultsHref,
}: {
  searchResultsHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          data-onboarding="search"
          aria-label="جست‌وجو"
          className="
            size-10 rounded-xl
            border border-border/50
            bg-card/45
            text-muted-foreground
            shadow-none
            transition-all duration-200

            hover:border-border
            hover:bg-card/80
            hover:text-foreground

            active:scale-95
          "
        >
          <Search className="size-[18px]" />
        </Button>
      </DialogTrigger>

      <DialogContent
        dir="rtl"
        className="
          w-[calc(100%-1.5rem)]
          max-w-xl
          max-h-[calc(100dvh-1.5rem)]
          overflow-y-auto
          rounded-3xl
          border-border/60
          bg-background/95
          p-0
          shadow-2xl
          backdrop-blur-xl

          sm:w-full
        "
      >
        <div
          className="
            border-b border-border/50
            bg-muted/20
            px-4 pb-4 pt-5
            sm:px-5 sm:pb-5
          "
        >
          <div className="flex items-center gap-3">
            <span
              className="
                flex size-10 shrink-0
                items-center justify-center
                rounded-xl
                bg-primary/10 text-primary
              "
            >
              <Search className="size-[18px]" />
            </span>

            <div className="min-w-0">
              <DialogTitle className="text-sm font-black text-foreground">
                جست‌وجوی سراسری
              </DialogTitle>

              <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                کتاب، نویسنده یا محتوای موردنظرت را پیدا کن
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 pb-5 sm:p-5">
          <SearchComponent
            resultsHref={searchResultsHref}
            onSearch={() => setOpen(false)}
            variant="dialog"
            placeholder="عنوان، نویسنده یا نسخهٔ کتاب..."
            className="w-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SiteHeader({
  user,
  isAdmin = false,
  branding,
}: {
  user?: HeaderUser | null;
  isAdmin?: boolean;
  branding: SiteBranding;
}) {
  const pathname = usePathname();

  const isAuthenticated = Boolean(user);

  const primaryNav = useMemo(
    () => getPrimaryNav(user?.username),
    [user?.username],
  );

  return (
    <header
      data-site-header
      className="
        sticky top-0 z-50 w-full
        border-b border-border/50
        bg-background/90
        backdrop-blur-xl

        supports-[backdrop-filter]:bg-background/75
      "
    >
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        {/* ==================== Desktop ==================== */}
        <div className="hidden h-[72px] items-center gap-4 lg:flex">
          {/* Brand + Navigation */}
          <div className="flex min-w-0 shrink-0 items-center gap-4 xl:gap-6">
            <Brand {...branding} />

            <nav
              aria-label="ناوبری اصلی"
              className="
                flex min-w-0 items-center
                rounded-2xl
                border border-border/40
                bg-muted/20
                p-1
              "
            >
              {primaryNav.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-onboarding={
                      item.href === "/books"
                        ? "nav-books"
                        : item.href === "/authors"
                          ? "nav-authors"
                          : undefined
                    }
                    className={cn(
                      `
                        relative flex h-9 items-center
                        whitespace-nowrap rounded-xl
                        px-3
                        text-xs font-bold
                        outline-none
                        transition-all duration-200

                        focus-visible:ring-2
                        focus-visible:ring-primary/30
                      `,
                      active
                        ? `
                          bg-background
                          text-primary
                          shadow-sm
                          ring-1 ring-border/40
                        `
                        : `
                          text-muted-foreground
                          hover:bg-background/60
                          hover:text-foreground
                        `,
                    )}
                  >
                    {item.label}

                    {active ? (
                      <span
                        className="
                          absolute inset-x-3 -bottom-1
                          h-0.5 rounded-full
                          bg-primary
                        "
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Search */}
          <div
            className="
              flex min-w-[180px] flex-1
              justify-center
              px-1
              xl:px-5
            "
          >
            <SearchComponent
              resultsHref="/books"
              onboardingTarget="search"
              className="
                w-full max-w-[26rem]
                transition-all
                focus-within:max-w-[30rem]
              "
            />
          </div>

          {/* Account */}
          <div
            className="
              flex shrink-0 items-center
              justify-end
            "
          >
            {isAuthenticated && user ? (
              <UserMenu user={user} isAdmin={isAdmin} />
            ) : (
              <GuestActions />
            )}
          </div>
        </div>

        {/* ==================== Mobile ==================== */}
        <div
          className="
            relative flex h-[60px]
            items-center justify-between
            lg:hidden
          "
        >
          {/* Right: Brand */}
          <div
            className="
              z-10 flex min-w-0 max-w-[58%]
              items-center
            "
          >
            <Brand {...branding} compact />
          </div>

          {/* Left: Search + Account */}
          <div className="z-10 flex shrink-0 items-center gap-1.5">
            <MobileSearchDialog searchResultsHref="/books" />

            {isAuthenticated && user ? (
              <div className="shrink-0">
                <UserMenu user={user} isAdmin={isAdmin} compact />
              </div>
            ) : (
              <Button
                asChild
                size="icon"
                variant="ghost"
                className="
                  size-10 rounded-xl
                  border border-border/50
                  bg-card/45
                  p-0
                  text-muted-foreground
                  shadow-none
                  transition-all duration-200

                  hover:border-border
                  hover:bg-card/80
                  hover:text-foreground

                  active:scale-95
                "
              >
                <Link href="/auth/login" aria-label="ورود">
                  <LogIn className="size-[18px]" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function GuestActions() {
  return (
    <div className="flex items-center gap-2">
      <Button
        asChild
        variant="ghost"
        className="
          h-10 rounded-xl
          px-3.5
          text-sm font-bold
          text-muted-foreground
          transition-colors

          hover:bg-muted
          hover:text-foreground
        "
      >
        <Link href="/auth/login">ورود</Link>
      </Button>

      <Button
        asChild
        className="
          h-10 rounded-xl
          px-4
          text-sm font-bold
          shadow-sm
          transition-all duration-200

          hover:-translate-y-0.5
          hover:shadow-md

          active:translate-y-0
          active:scale-[0.98]
        "
      >
        <Link href="/auth/signup">ثبت‌نام</Link>
      </Button>
    </div>
  );
}
