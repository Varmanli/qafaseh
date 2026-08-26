import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw, SearchX } from "lucide-react";

import BlogCard from "@/components/blog/BlogCard";
import { Button } from "@/components/ui/button";
import {
  buildBlogArchiveHref,
  type BlogArchiveSort as BlogArchiveSortValue,
} from "@/components/blog/blog-archive";
import type { PublicBlogPostPreview } from "@/lib/blog/service";

export default function BlogArchiveGrid({
  posts,
  page,
  pageCount,
  total,
  hasPublishedArticles = total > 0,
  q = "",
  category = "",
  sort = "newest",
}: {
  posts: PublicBlogPostPreview[];
  page: number;
  pageCount: number;
  total: number;
  hasPublishedArticles?: boolean;
  q?: string;
  category?: string;
  sort?: BlogArchiveSortValue;
}) {
  return (
    <section className="mt-4 sm:mt-5">
      {posts.length ? (
        <>
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>

          {pageCount > 1 ? (
            <Pagination
              currentPage={page}
              pageCount={pageCount}
              q={q}
              category={category}
              sort={sort}
            />
          ) : null}
        </>
      ) : (
        <EmptyState
          hasActiveFilters={Boolean(q.trim() || category.trim())}
          hasPublishedArticles={hasPublishedArticles}
        />
      )}
    </section>
  );
}

function EmptyState({
  hasActiveFilters,
  hasPublishedArticles,
}: {
  hasActiveFilters: boolean;
  hasPublishedArticles: boolean;
}) {
  const showClearFilters = hasActiveFilters && hasPublishedArticles;
  const title = showClearFilters ? "مقاله‌ای پیدا نشد" : "هنوز مقاله‌ای منتشر نشده";
  const description = showClearFilters
    ? "نتیجه‌ای مطابق جستجو یا فیلترهای انتخاب‌شده پیدا نشد."
    : "به‌زودی اولین مقاله‌های مجله قفسه اینجا منتشر می‌شوند.";

  return (
    <div className="my-12 flex justify-center sm:my-16">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/45 px-6 py-7 text-center sm:px-8 sm:py-8">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SearchX className="size-5" strokeWidth={1.8} />
        </div>
        <h3 className="mt-4 text-base font-black text-foreground">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
          {description}
        </p>
        {showClearFilters ? (
          <Button asChild variant="outline" size="sm" className="mt-5 border-border/70 bg-background/50">
            <Link href="/blog">
              <RotateCcw className="size-3.5" />
              پاک کردن فیلترها
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  pageCount,
  q,
  category,
  sort,
}: {
  currentPage: number;
  pageCount: number;
  q: string;
  category: string;
  sort: BlogArchiveSortValue;
}) {
  return (
    <nav
      aria-label="صفحه‌بندی مجله"
      className="mt-14 flex items-center justify-center gap-3"
    >
      {currentPage > 1 ? (
        <Link
          href={buildBlogArchiveHref({
            q,
            category,
            sort,
            page: currentPage - 1,
          })}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary hover:text-primary"
          aria-label="صفحه قبل"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}

      <div className="flex h-10 items-center gap-1 rounded-full border border-border/70 px-2">
        {Array.from({ length: pageCount })
          .slice(
            Math.max(0, currentPage - 3),
            Math.min(pageCount, currentPage + 2),
          )
          .map((_, index) => {
            const pageNumber = Math.max(0, currentPage - 3) + index + 1;

            return (
              <Link
                key={pageNumber}
                href={buildBlogArchiveHref({
                  q,
                  category,
                  sort,
                  page: pageNumber,
                })}
                className={
                  pageNumber === currentPage
                    ? "flex h-7 min-w-7 items-center justify-center rounded-full bg-foreground px-2 text-xs font-black text-background"
                    : "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                }
              >
                {pageNumber.toLocaleString("fa-IR")}
              </Link>
            );
          })}
      </div>

      {currentPage < pageCount ? (
        <Link
          href={buildBlogArchiveHref({
            q,
            category,
            sort,
            page: currentPage + 1,
          })}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary hover:text-primary"
          aria-label="صفحه بعد"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      ) : null}
    </nav>
  );
}
