"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  BookCopy,
  Building2,
  ChevronDown,
  FileText,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  ListOrdered,
  Languages,
  SearchCheck,
  Newspaper,
  PenTool,
  Quote as QuoteIcon,
  Palette,
  NotebookPen,
  Plus,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AdminNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  children: AdminNavItem[];
}

type AdminNavEntry =
  | {
      type: "item";
      item: AdminNavItem;
    }
  | {
      type: "group";
      group: AdminNavGroup;
    };

export const ADMIN_NAV: AdminNavEntry[] = [
  {
    type: "item",
    item: {
      href: "/admin",
      label: "داشبورد",
      icon: LayoutDashboard,
    },
  },
  {
    type: "item",
    item: {
      href: "/admin/stats",
      label: "آمار",
      icon: BarChart3,
    },
  },
  {
    type: "item",
    item: {
      href: "/admin/users",
      label: "کاربران",
      icon: Users,
    },
  },
  {
    type: "group",
    group: {
      id: "books",
      label: "کتاب‌ها",
      icon: BookCopy,
      children: [
        {
          href: "/admin/books",
          label: "همه کتاب‌ها",
          icon: BookCopy,
        },
        {
          href: "/admin/books/new",
          label: "افزودن کتاب جدید",
          icon: Plus,
        },
        {
          href: "/admin/books/import",
          label: "ورود گروهی کتاب‌ها",
          icon: FileText,
        },
        {
          href: "/admin/books/covers",
          label: "مدیریت کاورها",
          icon: Images,
        },
        {
          href: "/admin/approvals",
          label: "تأیید اطلاعات جدید",
          icon: BadgeCheck,
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      id: "book-import",
      label: "ورود کتاب",
      icon: SearchCheck,
      children: [
        { href: "/admin/books/import-links", label: "ورود از ایران‌کتاب", icon: SearchCheck },
        { href: "/admin/books/import-history", label: "تاریخچه ورود ایران‌کتاب", icon: FileText },
        { href: "/admin/iranketab-discovery/sources", label: "ورود خودکار ناشر", icon: Tags },
      ],
    },
  },
  {
    type: "group",
    group: {
      id: "references",
      label: "مراجع کتاب",
      icon: Tags,
      children: [
        {
          href: "/admin/categories",
          label: "دسته‌بندی‌ها",
          icon: Tags,
        },
        {
          href: "/admin/authors",
          label: "نویسنده‌ها",
          icon: PenTool,
        },
        {
          href: "/admin/publishers",
          label: "ناشرها",
          icon: Building2,
        },
        {
          href: "/admin/translators",
          label: "مترجم‌ها",
          icon: Languages,
        },
        {
          href: "/admin/references/import",
          label: "ایمپورت پروفایل‌ها",
          icon: FileText,
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      id: "content",
      label: "محتوا",
      icon: LayoutTemplate,
      children: [
        {
          href: "/admin/quotes",
          label: "تکه‌های کتاب",
          icon: QuoteIcon,
        },
        {
          href: "/admin/quotes/backgrounds",
          label: "پس‌زمینه‌های تکه کتاب",
          icon: Palette,
        },
        {
          href: "/admin/notes",
          label: "یادداشت‌ها",
          icon: NotebookPen,
        },
        {
          href: "/admin/home-content",
          label: "محتوای صفحه اصلی",
          icon: LayoutTemplate,
        },
        {
          href: "/admin/blog",
          label: "مطالب مجله قفسه",
          icon: Newspaper,
        },
        {
          href: "/admin/reading-lists",
          label: "لیست‌های مطالعه",
          icon: ListOrdered,
        },
        {
          href: "/admin/blog/categories",
          label: "دسته‌بندی‌های مجله",
          icon: Tags,
        },
        {
          href: "/admin/static-pages",
          label: "صفحات ثابت",
          icon: FileText,
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      id: "system",
      label: "سیستم",
      icon: Settings,
      children: [
        {
          href: "/admin/settings",
          label: "تنظیمات سایت",
          icon: Settings,
        },
      ],
    },
  },
];

const LEAF_HREFS = ADMIN_NAV.flatMap((entry) =>
  entry.type === "item"
    ? [entry.item.href]
    : entry.group.children.map((child) => child.href),
);

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") return false;
  if (!pathname.startsWith(href + "/")) return false;

  return !LEAF_HREFS.some(
    (leaf) =>
      leaf !== href &&
      leaf.length > href.length &&
      (pathname === leaf || pathname.startsWith(leaf + "/")),
  );
}

function isGroupActive(pathname: string, group: AdminNavGroup): boolean {
  return group.children.some((child) => isActive(pathname, child.href));
}

function getDefaultOpenGroups(pathname: string) {
  return ADMIN_NAV.reduce<Record<string, boolean>>((acc, entry) => {
    if (entry.type === "group") {
      acc[entry.group.id] = isGroupActive(pathname, entry.group);
    }

    return acc;
  }, {});
}

function NavLink({
  item,
  active,
  nested,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl px-3 text-sm transition-all",
        nested ? "py-2.5 text-[13px]" : "py-3 font-bold",
        active
          ? "bg-primary/12 text-primary shadow-[0_16px_45px_-36px_rgba(128,167,150,0.9)] ring-1 ring-primary/15"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
      )}
    >
      {active ? (
        <span className="absolute inset-y-2 right-0 w-1 rounded-l-full bg-primary" />
      ) : null}

      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-xl transition-colors",
          nested ? "h-8 w-8" : "h-9 w-9",
          active
            ? "bg-primary/12 text-primary"
            : "bg-card/70 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
        )}
      >
        <Icon className={cn(nested ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </span>

      <span className="min-w-0 break-words leading-5">{item.label}</span>
    </Link>
  );
}

function NavGroup({
  group,
  open,
  active,
  onToggle,
  onNavigate,
  pathname,
}: {
  group: AdminNavGroup;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  pathname: string;
}) {
  const Icon = group.icon;

  return (
    <div
      className="rounded-[1.4rem]"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-[1.35rem] px-3 py-3 text-right text-[13px] font-black transition-all",
          active
            ? "text-primary"
            : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              active || open
                ? "bg-primary/12 text-primary"
                : "bg-card/70 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>

          <span className="min-w-0 break-words leading-5">{group.label}</span>
        </span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      {open ? (
        <div className="px-2 pb-2">
          <div className="space-y-1 border-r border-border/70 pr-2">
            {group.children.map((child) => (
              <NavLink
                key={child.href}
                item={child}
                active={isActive(pathname, child.href)}
                nested
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const defaultOpenGroups = useMemo(
    () => getDefaultOpenGroups(pathname),
    [pathname],
  );

  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(defaultOpenGroups);

  useEffect(() => {
    setOpenGroups(getDefaultOpenGroups(pathname));
  }, [pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => ({
      ...Object.fromEntries(Object.keys(current).map((groupId) => [groupId, groupId === id ? !current[id] : false])),
    }));
  }

  return (
    <nav className="space-y-1.5">
      {ADMIN_NAV.map((entry) => {
        if (entry.type === "item") {
          return (
            <NavLink
              key={entry.item.href}
              item={entry.item}
              active={isActive(pathname, entry.item.href)}
              onNavigate={onNavigate}
            />
          );
        }

        const active = isGroupActive(pathname, entry.group);

        return (
          <NavGroup
            key={entry.group.id}
            group={entry.group}
            open={Boolean(openGroups[entry.group.id])}
            active={active}
            onToggle={() => toggleGroup(entry.group.id)}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        );
      })}
    </nav>
  );
}
