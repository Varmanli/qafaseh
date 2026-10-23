import type { Metadata } from "next";

import BlogArchiveGrid from "@/components/blog/BlogArchiveGrid";
import BlogArchiveToolbar from "@/components/blog/BlogArchiveToolbar";
import BlogCategoryShelf from "@/components/blog/BlogCategoryShelf";
import PublicShell from "@/components/PublicShell";
import {
  BLOG_PAGE_SIZE,
  hasPublishedBlogPosts,
  listPublicBlogCategories,
  listPublicBlogPosts,
} from "@/lib/blog/service";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { normalizeBlogArchiveSort } from "@/components/blog/blog-archive";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "مجله قفسه",
    description:
      "نوشته‌ها، یادداشت‌ها و مقاله‌های قفسه درباره خواندن و کشف کتاب.",
    path: "/blog",
    type: "website",
  });
}

export default async function BlogArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.category === "string" ? params.category : "";
  const sort = normalizeBlogArchiveSort(
    typeof params.sort === "string" ? params.sort : undefined,
  );
  const page = Math.max(
    1,
    Number(typeof params.page === "string" ? params.page : "1") || 1,
  );
  const [archive, categories, hasPublishedArticles] = await Promise.all([
    listPublicBlogPosts({
      q,
      categorySlug: category,
      sort,
      page,
      pageSize: BLOG_PAGE_SIZE,
    }),
    listPublicBlogCategories(),
    hasPublishedBlogPosts(),
  ]);

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <h1 className="sr-only">مجله قفسه</h1>
        <BlogCategoryShelf categories={categories} />
        <section id="magazine-articles" className="mt-12 scroll-mt-24 border-t border-border/60 pt-8 sm:mt-16 sm:pt-10" aria-labelledby="magazine-articles-title">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 id="magazine-articles-title" className="text-xl font-black sm:text-2xl">همه خواندنی‌ها</h2>
            <span className="text-xs text-muted-foreground">{archive.total.toLocaleString("fa-IR")} مقاله</span>
          </div>
        <BlogArchiveToolbar
          categories={categories}
          q={q}
          category={category}
          sort={sort}
        />

        <BlogArchiveGrid
          posts={archive.posts}
          total={archive.total}
          hasPublishedArticles={hasPublishedArticles}
          page={archive.page}
          pageCount={archive.pageCount}
          q={q}
          category={category}
          sort={sort}
          searchParams={params}
        />
        </section>
      </main>
    </PublicShell>
  );
}
