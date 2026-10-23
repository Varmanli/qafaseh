import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ChevronLeft } from "lucide-react";

import BlogArchiveGrid from "@/components/blog/BlogArchiveGrid";
import BlogArchiveToolbar from "@/components/blog/BlogArchiveToolbar";
import BlogCategoryCover from "@/components/blog/BlogCategoryCover";
import { normalizeBlogArchiveSort } from "@/components/blog/blog-archive";
import PublicShell from "@/components/PublicShell";
import { getMagazineCategory } from "@/lib/blog/categories";
import { decodeBlogCategorySlug } from "@/lib/blog/category-slug";
import { BLOG_PAGE_SIZE, getPublicBlogCategoryBySlug, listPublicBlogCategories, listPublicBlogPosts } from "@/lib/blog/service";
import { normalizeMediaUrl } from "@/lib/book/cover";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const requested = decodeBlogCategorySlug(slug);
  const category = await getPublicBlogCategoryBySlug(requested);
  const resolved = category ?? getMagazineCategory(requested);
  if (!resolved) return { title: "دسته‌بندی پیدا نشد | قفسه" };
  return buildPageMetadata({
    title: `${resolved.name} | مجله قفسه`,
    description: resolved.description || `نوشته‌ها و مقاله‌های مجله قفسه درباره ${resolved.name}.`,
    path: `/blog/category/${encodeURIComponent(resolved.slug)}`,
    image: normalizeMediaUrl(category?.coverImage),
  });
}

export default async function MagazineCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const requested = decodeBlogCategorySlug(slug);
  const category = await getPublicBlogCategoryBySlug(requested);
  const resolved = category ?? getMagazineCategory(requested);
  if (!resolved) notFound();

  const query = await searchParams;
  const pathname = `/blog/category/${encodeURIComponent(resolved.slug)}`;
  if (requested !== resolved.slug) {
    const preserved = new URLSearchParams();
    for (const key of ["q", "sort", "page"]) {
      if (typeof query[key] === "string") preserved.set(key, query[key]);
    }
    permanentRedirect(`${pathname}${preserved.size ? `?${preserved}` : ""}`);
  }
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const sort = normalizeBlogArchiveSort(typeof query.sort === "string" ? query.sort : undefined);
  const page = Math.max(1, Math.floor(Number(typeof query.page === "string" ? query.page : "1")) || 1);
  const [archive, categories] = await Promise.all([
    listPublicBlogPosts({ categorySlug: resolved.slug, q, sort, page, pageSize: BLOG_PAGE_SIZE }),
    listPublicBlogCategories(),
  ]);
  const postCount = categories.find((item) => item.slug === resolved.slug)?.postCount ?? 0;

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <nav aria-label="مسیر صفحه" className="mb-5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-primary">قفسه</Link><ChevronLeft aria-hidden="true" className="size-3" />
          <Link href="/blog" className="transition-colors hover:text-primary">مجله</Link><ChevronLeft aria-hidden="true" className="size-3" />
          <span aria-current="page" className="font-bold text-foreground">{resolved.name}</span>
        </nav>

        <header className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-card sm:grid sm:grid-cols-[1.1fr_1fr]">
          <div className="relative min-h-52 overflow-hidden sm:order-2 sm:min-h-80">
            <BlogCategoryCover src={category?.coverImage} slug={resolved.slug} sizes="(max-width: 640px) 100vw, 50vw" />
          </div>
          <div className="flex flex-col items-start justify-center p-6 sm:p-8 lg:p-11">
            <p className="flex items-center gap-2 text-[11px] font-bold text-primary"><span className="h-px w-6 bg-primary/50" /> یک قفسه از مجله</p>
            <h1 className="mt-4 text-2xl font-black leading-relaxed tracking-tight sm:text-3xl lg:text-4xl">{resolved.name}</h1>
            <p className="mt-3 max-w-lg text-sm leading-8 text-muted-foreground">{resolved.description || `نوشته‌ها و روایت‌هایی خواندنی از جهان ${resolved.name}؛ برای کشف ایده‌های تازه و عمیق‌تر خواندن.`}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs">
              <span className="rounded-full bg-primary/10 px-3 py-2 font-bold text-primary">{postCount ? `${postCount.toLocaleString("fa-IR")} مقاله خواندنی` : "در انتظار اولین روایت"}</span>
              <Link href="/blog" className="inline-flex items-center gap-2 font-bold text-muted-foreground transition-colors hover:text-primary">همه قفسه‌ها <ArrowLeft className="size-3.5" /></Link>
            </div>
          </div>
        </header>

        <section id="category-articles" className="mt-8 scroll-mt-24 sm:mt-10" aria-label={`مقاله‌های ${resolved.name}`}>
          <BlogArchiveToolbar q={q} sort={sort} pathname={pathname} />
          <BlogArchiveGrid posts={archive.posts} total={archive.total} hasPublishedArticles={postCount > 0}
            page={archive.page} pageCount={archive.pageCount} q={q} sort={sort}
            pathname={pathname} searchParams={query} emptyResetHref={pathname}
            emptyDescription={postCount ? undefined : "این قفسه تازه چیده شده؛ اولین مقاله‌هایش به‌زودی اینجا قرار می‌گیرند. تا آن وقت، قفسه‌های دیگر مجله را کشف کن."} />
        </section>
      </main>
    </PublicShell>
  );
}
