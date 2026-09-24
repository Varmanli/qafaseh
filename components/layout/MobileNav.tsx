"use client";

import type { ElementType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Home, ListOrdered, Newspaper } from "lucide-react";

import { getPrimaryNav } from "@/lib/layout/navigation";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function getNavigationIcon(href: string): ElementType {
  if (href === "/") return Home;
  if (href === "/discover") return Compass;
  if (href.startsWith("/books")) return BookOpen;
  if (href.startsWith("/lists")) return ListOrdered;

  return Newspaper;
}

export default function MobileNav() {
  const pathname = usePathname();
  const primaryLinks = getPrimaryNav();

  return (
    <nav
      dir="rtl"
      aria-label="ناوبری اصلی موبایل"
      className="
        fixed
        inset-x-0
        bottom-0
        z-50
        px-3
        pb-[max(0.75rem,env(safe-area-inset-bottom))]
        lg:hidden
      "
    >
      <div
        className="
          relative
          mx-auto
          flex
          w-full
          max-w-md
          items-center
          overflow-hidden
          rounded-[1.7rem]
          border
          border-border/60
          bg-background/80
          p-1.5
          shadow-[0_-8px_40px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.10)]
          backdrop-blur-2xl
          supports-[backdrop-filter]:bg-background/70

          before:pointer-events-none
          before:absolute
          before:inset-x-8
          before:top-0
          before:h-px
          before:bg-gradient-to-r
          before:from-transparent
          before:via-foreground/10
          before:to-transparent
        "
      >
        {primaryLinks.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = getNavigationIcon(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-onboarding={
                item.href === "/books"
                  ? "nav-books"
                  : item.href === "/lists"
                    ? "nav-lists"
                    : undefined
              }
              className={cn(
                `
                  group
                  relative
                  isolate
                  flex
                  min-h-[4.15rem]
                  flex-1
                  select-none
                  flex-col
                  items-center
                  justify-center
                  gap-1
                  rounded-[1.25rem]
                  px-1
                  outline-none
                  transition-[transform,color]
                  duration-300
                  ease-out

                  active:scale-[0.94]

                  focus-visible:ring-2
                  focus-visible:ring-primary/40
                  focus-visible:ring-offset-2
                  focus-visible:ring-offset-background
                `,
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* Active background */}
              <span
                aria-hidden="true"
                className={cn(
                  `
                    absolute
                    inset-0
                    -z-10
                    rounded-[1.25rem]
                    bg-primary/[0.09]
                    opacity-0
                    scale-[0.88]
                    transition-all
                    duration-300
                    ease-[cubic-bezier(0.22,1,0.36,1)]
                  `,
                  active && "scale-100 opacity-100",
                )}
              />

              {/* Top active indicator */}
              <span
                aria-hidden="true"
                className={cn(
                  `
                    absolute
                    top-0
                    h-[3px]
                    w-7
                    -translate-y-[1px]
                    rounded-full
                    bg-primary
                    opacity-0
                    scale-x-50
                    shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_45%,transparent)]
                    transition-all
                    duration-300
                    ease-[cubic-bezier(0.22,1,0.36,1)]
                  `,
                  active && "scale-x-100 opacity-100",
                )}
              />

              {/* Icon */}
              <span
                className={cn(
                  `
                    relative
                    flex
                    size-9
                    items-center
                    justify-center
                    rounded-xl
                    transition-all
                    duration-300
                    ease-[cubic-bezier(0.22,1,0.36,1)]

                    group-hover:-translate-y-0.5
                  `,
                  active
                    ? "-translate-y-0.5 bg-primary/10 shadow-[0_6px_16px_rgba(0,0,0,0.05)]"
                    : "group-active:translate-y-0",
                )}
              >
                <Icon
                  aria-hidden="true"
                  strokeWidth={active ? 2.25 : 1.8}
                  className={cn(
                    `
                      size-[1.3rem]
                      transition-all
                      duration-300
                      ease-[cubic-bezier(0.22,1,0.36,1)]
                    `,
                    active ? "scale-110" : "scale-100 group-hover:scale-105",
                  )}
                />

                {/* Active icon glow */}
                <span
                  aria-hidden="true"
                  className={cn(
                    `
                      absolute
                      inset-1
                      -z-10
                      rounded-full
                      bg-primary/20
                      blur-lg
                      opacity-0
                      transition-opacity
                      duration-300
                    `,
                    active && "opacity-70",
                  )}
                />
              </span>

              {/* Label */}
              <span
                className={cn(
                  `
                    max-w-full
                    truncate
                    text-[10px]
                    leading-none
                    tracking-tight
                    transition-all
                    duration-300
                  `,
                  active
                    ? "translate-y-0 font-bold opacity-100"
                    : "font-medium opacity-75 group-hover:opacity-100",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
