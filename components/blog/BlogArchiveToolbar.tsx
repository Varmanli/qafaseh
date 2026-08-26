"use client";

import { useRouter } from "next/navigation";

import BlogSearchForm from "@/components/blog/BlogSearchForm";
import BlogArchiveSort from "@/components/blog/BlogArchiveSort";
import {
  buildBlogArchiveHref,
  type BlogArchiveSort as BlogArchiveSortValue,
} from "@/components/blog/blog-archive";

type Category = { slug: string; name: string };

export default function BlogArchiveToolbar({
  categories,
  q,
  category,
  sort,
}: {
  categories: Category[];
  q: string;
  category: string;
  sort: BlogArchiveSortValue;
}) {
  const router = useRouter();
  const navigate = (next: { q?: string; category?: string; sort?: BlogArchiveSortValue }) => {
    router.push(buildBlogArchiveHref({ q, category, sort, ...next }));
  };

  return (
    <section className="mt-6 grid grid-cols-1 gap-x-3 gap-y-3 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto]" aria-label="ابزارهای مرور مجله">
      <div className="min-w-0">
        <BlogSearchForm
          q={q}
          category={category}
          sort={sort}
          placeholder="جستجو در مجله..."
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:col-span-2 sm:row-start-2 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-2 pb-1">
          <button
            type="button"
            onClick={() => navigate({ category: "" })}
            className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${!category ? "border-primary/35 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
          >
            همه
          </button>
          {categories.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => navigate({ category: item.slug })}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${category === item.slug ? "border-primary/35 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="sm:col-start-2 sm:row-start-1">
        <BlogArchiveSort q={q} category={category} sort={sort} />
      </div>
    </section>
  );
}
