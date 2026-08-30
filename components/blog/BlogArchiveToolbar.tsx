"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BlogArchiveSort from "@/components/blog/BlogArchiveSort";
import { ArchiveFilterButton, ArchiveSearch, ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { buildBlogArchiveHref, type BlogArchiveSort as BlogArchiveSortValue } from "@/components/blog/blog-archive";

type Category = { slug: string; name: string };

export default function BlogArchiveToolbar({ categories, q, category, sort }: { categories: Category[]; q: string; category: string; sort: BlogArchiveSortValue }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [filtersOpen, setFiltersOpen] = useState(Boolean(category));
  useEffect(() => setQuery(q), [q]);
  const navigate = (next: { q?: string; category?: string; sort?: BlogArchiveSortValue }) => router.push(buildBlogArchiveHref({ q, category, sort, ...next }));

  return (
    <ArchiveToolbar label="ابزارهای مرور مجله" below={filtersOpen ? <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"><div className="flex w-max min-w-full gap-2 pb-1"><button type="button" onClick={() => navigate({ category: "" })} className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${!category ? "border-primary/35 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}>همه</button>{categories.map((item) => <button key={item.slug} type="button" onClick={() => navigate({ category: item.slug })} className={`rounded-md border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${category === item.slug ? "border-primary/35 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}>{item.name}</button>)}</div></div> : null}>
      <ArchiveSearch value={query} onChange={setQuery} onClear={() => { setQuery(""); navigate({ q: "" }); }} onSubmit={(event) => { event.preventDefault(); navigate({ q: query }); }} name="q" placeholder="جستجو در مجله..." ariaLabel="جستجو در مجله قفسه" />
      <ArchiveFilterButton activeCount={category ? 1 : 0} label="فیلتر دسته‌بندی مجله" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)} />
      <div className="shrink-0 lg:order-3"><BlogArchiveSort q={q} category={category} sort={sort} /></div>
    </ArchiveToolbar>
  );
}
