import type { Metadata } from "next";

import BlogArchiveGrid from "@/components/blog/BlogArchiveGrid";
import BlogArchiveToolbar from "@/components/blog/BlogArchiveToolbar";
import PublicShell from "@/components/PublicShell";
import {
  BLOG_PAGE_SIZE,
  hasPublishedBlogPosts,
  listBlogCategoryOptions,
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
    listBlogCategoryOptions(),
    hasPublishedBlogPosts(),
  ]);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
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
        />
      </main>
    </PublicShell>
  );
}
