import { getLibraryPath, getProfilePath } from "@/lib/library/paths";

export interface NavLinkItem {
  label: string;
  href: string;
  description?: string;
}

export function getPrimaryNav(username?: string | null): NavLinkItem[] {
  return [
    { label: "خانه", href: "/" },
    { label: "کتاب‌ها", href: "/books" },
    { label: "کشف کتاب", href: "/discover" },
    { label: "مسیرهای مطالعه", href: "/lists" },
    { label: "مجله قفسه", href: "/blog" },
  ];
}

export function getFooterPrimaryNav(
  username?: string | null,
): NavLinkItem[] {
  return [
    { label: "خانه", href: "/" },
    { label: "کشف کتاب", href: "/discover" },
    { label: "کتاب‌ها", href: "/books" },
    { label: "نویسنده‌ها", href: "/authors" },
    { label: "مجله قفسه", href: "/blog" },
    { label: "درباره ما", href: "/about" },
  ];
}

export function getFooterUserLinks(username?: string | null): NavLinkItem[] {
  return [
    {
      label: "کتابخانه من",
      href: username ? getLibraryPath(username) : "/auth/login?redirect=/books",
    },
    {
      label: "پروفایل من",
      href: username
        ? getProfilePath(username)
        : "/auth/login?redirect=/settings/profile",
    },
    {
      label: "تنظیمات",
      href: username ? "/settings/profile" : "/auth/login?redirect=/settings/profile",
    },
  ];
}

export const FOOTER_LEGAL_LINKS: NavLinkItem[] = [
  { label: "درباره ما", href: "/about" },
  { label: "راهنمای استفاده", href: "/help" },
  { label: "قوانین و مقررات", href: "/terms" },
  { label: "حریم خصوصی", href: "/privacy" },
  { label: "تماس با ما", href: "/contact" },
];
