"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Loader2,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";

import type { LayoutUser } from "@/components/layout/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileMenuTour from "@/components/onboarding/ProfileMenuTour";
import { getLibraryPath, getProfilePath } from "@/lib/library/paths";
import { cn } from "@/lib/utils";

interface MenuItem {
  label: string;
  href: string;
  icon: ElementType;
  onboardingTarget?: string;
}

function getDisplayName(user: LayoutUser) {
  return user.name?.trim() || user.username?.trim() || "کاربر قفسه";
}

function getInitial(user: LayoutUser) {
  return getDisplayName(user).charAt(0) || "ق";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function UserMenu({
  user,
  isAdmin = false,
  compact = false,
}: {
  user: LayoutUser;
  isAdmin?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const router = useRouter();

  const displayName = getDisplayName(user);

  const secondaryIdentity = user.username ? `@${user.username}` : user.email;

  const primaryItems = useMemo<MenuItem[]>(
    () => [
      {
        label: "پروفایل من",
        href: getProfilePath(user.username),
        icon: UserRound,
        onboardingTarget: "profile-menu-profile",
      },
      {
        label: "کتابخانه من",
        href: getLibraryPath(user.username),
        icon: BookOpen,
        onboardingTarget: "profile-menu-library",
      },
      {
        label: "گزارش مطالعه",
        href: "/dashboard",
        icon: BarChart3,
        onboardingTarget: "profile-menu-dashboard",
      },
      {
        label: "تنظیمات",
        href: "/settings/profile",
        icon: Settings,
        onboardingTarget: "profile-menu-settings",
      },
    ],
    [user.username],
  );

  const adminItems = useMemo<MenuItem[]>(
    () =>
      isAdmin
        ? [
            {
              label: "پنل مدیریت",
              href: "/admin",
              icon: ShieldCheck,
            },
          ]
        : [],
    [isAdmin],
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);

      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("logout failed");
      }

      setOpen(false);

      toast.success("با موفقیت خارج شدید");

      router.push("/auth/login");
      router.refresh();
    } catch {
      toast.error("خروج از حساب انجام نشد");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div ref={rootRef} className="relative" dir="rtl">
      {/* Trigger */}
      <button
        type="button"
        aria-label="منوی حساب کاربری"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          `
            group
            outline-none
            transition-all duration-200

            focus-visible:ring-2
            focus-visible:ring-primary/30
            focus-visible:ring-offset-2
            focus-visible:ring-offset-background

            active:scale-[0.97]
          `,
          compact
            ? `
              flex size-10
              items-center justify-center
              rounded-xl
              border border-border/50
              bg-card/45

              hover:border-border
              hover:bg-card/80
            `
            : `
              flex h-10
              items-center gap-2
              rounded-xl
              border border-transparent
              px-1.5

              hover:border-border/50
              hover:bg-muted/45

              xl:pr-1.5 xl:pl-2.5
            `,
          open &&
            `
              border-border/60
              bg-muted/55
            `,
        )}
      >
        <Avatar
          className={cn(
            `
              shrink-0
              border border-border/60
              bg-secondary
              shadow-sm
            `,
            compact ? "size-8" : "size-8",
          )}
        >
          {user.image ? (
            <AvatarImage
              src={user.image}
              alt={displayName}
              className="object-cover"
            />
          ) : null}

          <AvatarFallback
            className="
              bg-secondary
              text-[11px] font-black
              text-foreground
            "
          >
            {getInitial(user)}
          </AvatarFallback>
        </Avatar>

        {!compact ? (
          <>
            <div className="hidden min-w-0 text-right xl:block">
              <p
                className="
                  max-w-28 truncate
                  text-xs font-bold
                  text-foreground
                "
              >
                {displayName}
              </p>
            </div>

            <ChevronDown
              className={cn(
                `
                  hidden size-3.5
                  shrink-0
                  text-muted-foreground
                  transition-transform duration-200
                  xl:block
                `,
                open && "rotate-180",
              )}
            />
          </>
        ) : null}
      </button>

      {/* Menu */}
      {open ? (
        <div
          role="menu"
          aria-label="حساب کاربری"
          className="
            absolute left-0 top-full z-50
            mt-2.5
            w-[min(19rem,calc(100vw-1.5rem))]
            overflow-hidden
            rounded-2xl
            border border-border/60
            bg-popover/95
            p-1.5
            shadow-[0_24px_70px_-34px_rgba(0,0,0,0.5)]
            backdrop-blur-xl

            sm:w-72
            sm:rounded-3xl
            sm:p-2
          "
        >
          {/* User identity */}
          <div
            className="
              rounded-2xl
              border border-border/40
              bg-background/45
              p-3
            "
          >
            <div className="flex items-center gap-3">
              <Avatar
                className="
                  size-11 shrink-0
                  border border-border/60
                  shadow-sm
                "
              >
                {user.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={displayName}
                    className="object-cover"
                  />
                ) : null}

                <AvatarFallback
                  className="
                    bg-secondary
                    text-sm font-black
                    text-foreground
                  "
                >
                  {getInitial(user)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p
                    className="
                      min-w-0 truncate
                      text-sm font-black
                      text-foreground
                    "
                  >
                    {displayName}
                  </p>

                  {isAdmin ? (
                    <span
                      title="مدیر"
                      className="
                        flex size-5 shrink-0
                        items-center justify-center
                        rounded-md
                        bg-primary/10
                        text-primary
                      "
                    >
                      <ShieldCheck className="size-3" />
                    </span>
                  ) : null}
                </div>

                {secondaryIdentity ? (
                  <p
                    dir="ltr"
                    className="
                      mt-0.5 truncate
                      text-left text-[11px]
                      text-muted-foreground
                    "
                  >
                    {secondaryIdentity}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Primary navigation */}
          <div className="mt-1.5 space-y-0.5">
            {primaryItems.map((item) => (
              <MenuLink
                key={item.label}
                item={item}
                active={isActivePath(pathname, item.href)}
                onSelect={() => setOpen(false)}
              />
            ))}
          </div>

          {/* Admin */}
          {adminItems.length > 0 ? (
            <>
              <Divider />

              <div className="space-y-0.5">
                {adminItems.map((item) => (
                  <MenuLink
                    key={item.label}
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    onSelect={() => setOpen(false)}
                    emphasized
                  />
                ))}
              </div>
            </>
          ) : null}

          <Divider />

          {/* Logout */}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="
              group
              flex h-10 w-full
              items-center gap-3
              rounded-xl
              px-3
              text-xs font-bold
              text-rose-500
              outline-none
              transition-all duration-150

              hover:bg-rose-500/10

              focus-visible:ring-2
              focus-visible:ring-rose-500/20

              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <span
              className="
                flex size-7 shrink-0
                items-center justify-center
                rounded-lg
                bg-rose-500/10
                transition-colors
                group-hover:bg-rose-500/15
              "
            >
              {loggingOut ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LogOut className="size-3.5" />
              )}
            </span>

            <span>{loggingOut ? "در حال خروج..." : "خروج از حساب"}</span>
          </button>
        </div>
      ) : null}

      <ProfileMenuTour open={open} />
    </div>
  );
}

function MenuLink({
  item,
  active,
  onSelect,
  emphasized = false,
}: {
  item: MenuItem;
  active: boolean;
  onSelect: () => void;
  emphasized?: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      data-onboarding={item.onboardingTarget}
      onClick={onSelect}
      className={cn(
        `
          group
          flex h-10 w-full
          items-center gap-3
          rounded-xl
          px-3
          text-xs font-bold
          outline-none
          transition-all duration-150

          focus-visible:ring-2
          focus-visible:ring-primary/20
        `,
        active
          ? `
            bg-primary/[0.08]
            text-primary
          `
          : `
            text-foreground/85
            hover:bg-muted/50
            hover:text-foreground
          `,
        emphasized &&
          !active &&
          `
            text-primary
            hover:bg-primary/[0.06]
          `,
      )}
    >
      <span
        className={cn(
          `
            flex size-7 shrink-0
            items-center justify-center
            rounded-lg
            transition-colors
          `,
          active || emphasized
            ? `
              bg-primary/10
              text-primary
            `
            : `
              bg-muted/60
              text-muted-foreground
              group-hover:text-foreground
            `,
        )}
      >
        <Icon className="size-3.5" />
      </span>

      <span className="min-w-0 flex-1 truncate text-right">{item.label}</span>

      {active ? (
        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
      ) : null}
    </Link>
  );
}

function Divider() {
  return (
    <div className="my-1.5 px-2">
      <div className="h-px bg-border/50" />
    </div>
  );
}
