import Link from "next/link";
import { Search, X } from "lucide-react";

import { buildBlogArchiveHref } from "@/components/blog/blog-archive";
import type { BlogArchiveSort } from "@/components/blog/blog-archive";

export default function BlogSearchForm({ q = "", category = "", sort = "newest", action = "/blog", compact = false, placeholder = "جستجو در نوشته‌ها، کتاب‌ها و ایده‌ها..." }: { q?: string; category?: string; sort?: BlogArchiveSort; action?: string; compact?: boolean; placeholder?: string }) {
  const resetHref = action === "/blog" ? buildBlogArchiveHref({ category, sort }) : action;
  return <form method="get" action={action} role="search" className="w-full"><div className="group relative"><Search className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" /><input type="search" name="q" dir="rtl" defaultValue={q} placeholder={placeholder} aria-label="جستجو در مجله قفسه" className={`h-14 w-full border border-border/70 bg-background/80 pr-12 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-[3px] focus:ring-primary/10 ${compact ? "rounded-2xl pl-28" : "rounded-2xl pl-14 shadow-sm"}`} />{category ? <input type="hidden" name="category" value={category} /> : null}{sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}{q ? <Link href={resetHref} aria-label="پاک کردن جستجو" className="absolute left-[4.75rem] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></Link> : null}<button type="submit" className="absolute left-2 top-2 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground transition hover:bg-primary/90">جستجو</button></div></form>;
}
