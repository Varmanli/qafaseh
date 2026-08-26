import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  Clock3,
  Layers3,
} from "lucide-react";

import BlogArchiveGrid from "@/components/blog/BlogArchiveGrid";
import BlogCoverImage from "@/components/blog/BlogCoverImage";
import PublicShell from "@/components/PublicShell";
import { getMagazineCategory } from "@/lib/blog/categories";
import { decodeBlogCategorySlug } from "@/lib/blog/category-slug";
import {
  BLOG_PAGE_SIZE,
  getPublicBlogCategoryBySlug,
  listPublicBlogPosts,
} from "@/lib/blog/service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const requestedSlug = decodeBlogCategorySlug(slug);

  const category =
    getMagazineCategory(requestedSlug) ??
    (await getPublicBlogCategoryBySlug(requestedSlug));

  if (!category) {
    return {
      title: "دسته‌بندی پیدا نشد | قفسه",
    };
  }

  return buildPageMetadata({
    title: `${category.name} | مجله قفسه`,
    description:
      category.description ||
      "مطالب منتخب مجله قفسه برای کشف کتاب‌ها، نویسندگان و جهان ادبیات.",
    path: `/blog/category/${encodeURIComponent(category.slug)}`,
  });
}

export default async function MagazineCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const requestedSlug = decodeBlogCategorySlug(slug);

  const fallback = getMagazineCategory(requestedSlug);
  const category = await getPublicBlogCategoryBySlug(requestedSlug);

  if (!fallback && !category) {
    notFound();
  }

  const categorySlug = category?.slug ?? fallback!.slug;
  if (requestedSlug !== categorySlug) {
    permanentRedirect(`/blog/category/${encodeURIComponent(categorySlug)}`);
  }

  const page = Math.max(1, Number((await searchParams).page ?? "1") || 1);

  const archive = await listPublicBlogPosts({
    categorySlug,
    page,
    pageSize: BLOG_PAGE_SIZE,
  });

  const name = category?.name ?? fallback!.name;
  const description =
    category?.description ||
    fallback?.description ||
    `نوشته‌ها، تحلیل‌ها و مطالب منتخب مجله قفسه در دسته ${name}.`;

  /*
   * جدیدترین مطلب فقط در صفحه اول
   * به شکل Feature نمایش داده می‌شود.
   */
  const featuredPost =
    page === 1 && archive.posts.length > 0 ? archive.posts[0] : null;

  const gridPosts = featuredPost ? archive.posts.slice(1) : archive.posts;

  return (
    <PublicShell>
      <main dir="rtl" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* =========================================================
            Category masthead
        ========================================================= */}
        <section className="border-b border-border/60 py-7 sm:py-9 lg:py-10">
          {/* Breadcrumb */}
          <nav
            aria-label="مسیر صفحه"
            className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
          >
            <Link href="/" className="transition-colors hover:text-foreground">
              قفسه
            </Link>

            <ChevronLeft className="h-3 w-3 opacity-40" />

            <Link
              href="/blog"
              className="transition-colors hover:text-foreground"
            >
              مجله
            </Link>

            <ChevronLeft className="h-3 w-3 opacity-40" />

            <span className="font-bold text-foreground">{name}</span>
          </nav>

          <div className="mt-7 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            {/* Main info */}
            <div className="max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Layers3 className="h-4 w-4" />
                </span>

                <span className="text-xs font-black text-primary">
                  دسته‌بندی مجله
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-black leading-[1.4] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
                {name}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">
                {description}
              </p>
            </div>

            {/* Action */}
            <div className="flex shrink-0 items-center gap-3">
              {page > 1 ? (
                <span className="inline-flex h-10 items-center rounded-xl bg-muted/60 px-4 text-xs font-bold text-muted-foreground">
                  صفحه {page.toLocaleString("fa-IR")}
                </span>
              ) : null}

              <Link
                href="/blog"
                className="group inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 px-4 text-xs font-bold text-foreground transition hover:border-primary/30 hover:text-primary"
              >
                همه مطالب مجله
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================================
            Featured article
        ========================================================= */}
        {featuredPost ? (
          <section
            className="mt-8 sm:mt-10 lg:mt-12"
            aria-labelledby="featured-category-post"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-6 bg-primary/50" />

              <p className="text-[11px] font-black text-primary">
                تازه‌ترین مطلب این بخش
              </p>
            </div>

            <Link
              href={`/blog/${encodeURIComponent(featuredPost.slug)}`}
              className="group relative isolate block min-h-[390px] overflow-hidden rounded-[1.75rem] bg-muted sm:min-h-[480px] lg:min-h-[540px]"
            >
              <BlogCoverImage
                src={featuredPost.bannerImage}
                alt={featuredPost.title}
                sizes="(max-width: 1024px) 100vw, 1200px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
              />

              {/* Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />

              <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/55 to-transparent" />

              {/* top label */}
              <div className="absolute right-5 top-5 sm:right-7 sm:top-7">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-bold text-white/90 backdrop-blur-md">
                  <BookOpen className="h-3 w-3" />

                  {featuredPost.categoryName || name}
                </span>
              </div>

              {/* Content */}
              <article className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-9">
                <div className="max-w-3xl">
                  <h2
                    id="featured-category-post"
                    className="text-xl font-black leading-9 text-white sm:text-3xl sm:leading-[1.55] lg:text-4xl"
                  >
                    {featuredPost.title}
                  </h2>

                  {featuredPost.excerpt ? (
                    <p className="mt-3 line-clamp-2 max-w-2xl text-xs leading-6 text-white/70 sm:text-sm sm:leading-7">
                      {featuredPost.excerpt}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-white/60 sm:text-xs">
                      <span>
                        {featuredPost.publishedAt.toLocaleDateString("fa-IR")}
                      </span>

                      {featuredPost.readingTime ? (
                        <>
                          <span className="text-white/30">•</span>

                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3 w-3" />
                            {featuredPost.readingTime.toLocaleString(
                              "fa-IR",
                            )}{" "}
                            دقیقه مطالعه
                          </span>
                        </>
                      ) : null}
                    </div>

                    <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 text-xs font-bold text-white backdrop-blur-md transition-colors group-hover:bg-white group-hover:text-black">
                      مطالعه مطلب
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          </section>
        ) : null}

        {/* =========================================================
            Archive
        ========================================================= */}
        <section
          className={
            featuredPost ? "mt-12 sm:mt-16 lg:mt-20" : "mt-8 sm:mt-10 lg:mt-12"
          }
        >
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold text-primary">آرشیو {name}</p>

              <h2 className="mt-1.5 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {page === 1 ? "مطالب بیشتر" : "نوشته‌های این صفحه"}
              </h2>
            </div>

            {archive.pageCount > 1 ? (
              <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                صفحه {archive.page.toLocaleString("fa-IR")} از{" "}
                {archive.pageCount.toLocaleString("fa-IR")}
              </span>
            ) : null}
          </div>

          <BlogArchiveGrid
            posts={gridPosts}
            total={archive.total}
            page={archive.page}
            pageCount={archive.pageCount}
            category={categorySlug}
          />
        </section>
      </main>
    </PublicShell>
  );
}
