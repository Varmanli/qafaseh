import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import ArticleReadingExperience from "@/components/blog/ArticleReadingExperience";
import ArticleShare from "@/components/blog/ArticleShare";
import BlogCard from "@/components/blog/BlogCard";
import BlogContentRenderer from "@/components/blog/BlogContentRenderer";
import BlogCoverImage from "@/components/blog/BlogCoverImage";
import MagazineRelatedEntities from "@/components/blog/MagazineRelatedEntities";
import ReadingProgressBar from "@/components/blog/ReadingProgressBar";
import PublicShell from "@/components/PublicShell";

import { prepareArticleContent } from "@/lib/blog/article-content";
import {
  getMagazineRelatedEntities,
  getPublicBlogPostBySlug,
  getRelatedPublishedBlogPosts,
} from "@/lib/blog/service";

import { buildPageMetadata } from "@/lib/seo/metadata";
import { toAbsoluteUrl } from "@/lib/seo/site";
import {
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

/* ==========================================================================
   Metadata
   ========================================================================== */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const post = await getPublicBlogPostBySlug(decodeURIComponent(slug));

  if (!post) {
    return {
      title: "نوشته پیدا نشد | قفسه",
    };
  }

  return buildPageMetadata({
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    path: post.canonicalUrl || `/blog/${encodeURIComponent(post.slug)}`,
    image: post.ogImage || post.bannerImage,
    type: "article",
  });
}

/* ==========================================================================
   Page
   ========================================================================== */

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await getPublicBlogPostBySlug(decodeURIComponent(slug));

  if (!post) {
    notFound();
  }

  const [relatedPosts, relatedEntities] = await Promise.all([
    getRelatedPublishedBlogPosts(post),
    getMagazineRelatedEntities(post),
  ]);

  const preparedContent = prepareArticleContent(post.content);

  const articlePath = `/blog/${encodeURIComponent(post.slug)}`;

  const canonicalUrl = post.canonicalUrl || toAbsoluteUrl(articlePath);

  const articleImage = post.ogImage || post.bannerImage || undefined;

  /* --------------------------------------------------------------------------
     Structured data
     -------------------------------------------------------------------------- */

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    {
      name: "قفسه",
      url: toAbsoluteUrl("/"),
    },
    {
      name: "مجله قفسه",
      url: toAbsoluteUrl("/blog"),
    },

    ...(post.categoryName && post.categorySlug
      ? [
          {
            name: post.categoryName,
            url: toAbsoluteUrl(
              `/blog/category/${encodeURIComponent(post.categorySlug)}`,
            ),
          },
        ]
      : []),

    {
      name: post.title,
      url: toAbsoluteUrl(articlePath),
    },
  ]);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",

    headline: post.title,

    description: post.seoDescription || post.excerpt || undefined,

    image: articleImage ? [toAbsoluteUrl(articleImage)] : undefined,

    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),

    articleSection: post.categoryName || undefined,

    author: post.authorName
      ? [
          {
            "@type": "Person",
            name: post.authorName,
          },
        ]
      : undefined,

    mainEntityOfPage: canonicalUrl,
  };

  return (
    <PublicShell>
      {/* Reading progress */}
      <ReadingProgressBar targetId="article-content-column" />

      <article
        dir="rtl"
        className="
          article-page
          mx-auto
          w-full
          max-w-7xl
          px-3
          pb-24
          sm:px-6
        "
      >
        {/* ================================================================
            Structured data
        ================================================================= */}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(breadcrumbJsonLd),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(articleJsonLd),
          }}
        />

        {/* ================================================================
            Reading experience
        ================================================================= */}

        <ArticleReadingExperience
          headings={preparedContent.headings}
          shareAction={
            <ArticleShare
              title={post.title}
              description={post.seoDescription || post.excerpt}
              canonicalUrl={canonicalUrl}
              coverImage={articleImage}
              category={post.categoryName}
              readingTime={post.readingTime}
            />
          }
        >
          {/* ==============================================================
              Breadcrumb
          =============================================================== */}

          <nav
            aria-label="مسیر صفحه"
            className="
              article-breadcrumb
              mb-6
              mt-4
              flex
              flex-wrap
              items-center
              gap-1.5
              text-[11px]
              font-medium
              text-muted-foreground
              sm:text-xs
            "
          >
            <Link
              href="/"
              className="
                transition-colors
                hover:text-foreground
              "
            >
              قفسه
            </Link>

            <ChevronLeft className="h-3 w-3 opacity-40" />

            <Link
              href="/blog"
              className="
                transition-colors
                hover:text-foreground
              "
            >
              مجله
            </Link>

            {post.categoryName && post.categorySlug ? (
              <>
                <ChevronLeft className="h-3 w-3 opacity-40" />

                <Link
                  href={`/blog/category/${encodeURIComponent(
                    post.categorySlug,
                  )}`}
                  className="
                    font-bold
                    text-foreground/80
                    transition-colors
                    hover:text-primary
                  "
                >
                  {post.categoryName}
                </Link>
              </>
            ) : null}
          </nav>

          {/* ==============================================================
              Article hero
          =============================================================== */}

          <header className="article-hero">
            <div
              data-magazine-hero-image
              className="
                article-hero-image
                relative
                aspect-[16/10]
                w-full
                overflow-hidden
                md:aspect-auto
                md:min-h-[560px]
                lg:min-h-[620px]
              "
            >
              <BlogCoverImage
                src={post.bannerImage}
                alt={post.title}
                sizes="
                  (max-width: 768px) 100vw,
                  (max-width: 1280px) 95vw,
                  1280px
                "
                priority
                className="
                  article-hero-cover
                  object-cover
                  transition-transform
                  duration-700
                "
              />

              {/* Cinematic depth */}
              <div
                aria-hidden="true"
                className="
                  article-hero-overlay
                  absolute
                  inset-0
                  bg-gradient-to-t
                  from-black/25
                  via-black/10
                  to-transparent
                  md:from-black/90
                  md:via-black/40
                  md:to-black/10
                "
              />

              <div
                aria-hidden="true"
                className="
                  pointer-events-none
                  absolute
                  inset-x-0
                  bottom-0
                  hidden
                  h-3/4
                  bg-gradient-to-t
                  from-black/45
                  to-transparent
                  md:block
                "
              />

              {/* Hero content */}
              <div
                className="
                  article-hero-content
                  absolute
                  inset-x-0
                  bottom-0
                  hidden
                  p-5
                  sm:p-8
                  md:block
                  lg:p-12
                "
              >
                <div className="max-w-5xl">
                  {/* Meta */}
                  <div
                    className="
                      mb-4
                      flex
                      flex-wrap
                      items-center
                      gap-2.5
                      text-[10px]
                      font-bold
                      text-white/70
                      sm:mb-5
                      sm:text-xs
                    "
                  >
                    {post.categoryName ? (
                      post.categorySlug ? (
                        <Link
                          href={`/blog/category/${encodeURIComponent(
                            post.categorySlug,
                          )}`}
                          className="
                            rounded-full
                            border
                            border-white/15
                            bg-black/20
                            px-3
                            py-1.5
                            text-white
                            backdrop-blur-md
                            transition-colors
                            hover:bg-white/15
                          "
                        >
                          {post.categoryName}
                        </Link>
                      ) : (
                        <span
                          className="
                            rounded-full
                            border
                            border-white/15
                            bg-black/20
                            px-3
                            py-1.5
                            text-white
                            backdrop-blur-md
                          "
                        >
                          {post.categoryName}
                        </span>
                      )
                    ) : null}

                    <time
                      dateTime={post.publishedAt.toISOString()}
                      className="flex items-center gap-2"
                    >
                      <span className="h-1 w-1 rounded-full bg-white/40" />

                      {post.publishedAt.toLocaleDateString("fa-IR")}
                    </time>

                    {post.readingTime ? (
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                        {post.readingTime.toLocaleString("fa-IR")} دقیقه مطالعه
                      </span>
                    ) : null}
                  </div>

                  {/* Title */}
                  <h1
                    className="
                      max-w-5xl
                      text-xl
                      font-black
                      leading-[1.65]
                      tracking-tight
                      text-white

                      sm:text-4xl
                      sm:leading-[1.55]

                      lg:text-5xl
                      lg:leading-[1.45]
                    "
                  >
                    {post.title}
                  </h1>

                  {/* Excerpt */}
                  {post.excerpt ? (
                    <p
                      className="
                        mt-4
                        max-w-3xl
                        text-xs
                        leading-7
                        text-white/70

                        sm:mt-5
                        sm:text-base
                        sm:leading-8
                      "
                    >
                      {post.excerpt}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <div className="px-1 pt-5 md:hidden">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold leading-6 text-muted-foreground">
              {post.categoryName ? (
                post.categorySlug ? (
                  <Link href={`/blog/category/${encodeURIComponent(post.categorySlug)}`} className="text-primary transition-colors hover:text-primary/80">
                    {post.categoryName}
                  </Link>
                ) : <span className="text-primary">{post.categoryName}</span>
              ) : null}
              {post.categoryName ? <span aria-hidden="true">•</span> : null}
              <time dateTime={post.publishedAt.toISOString()}>{post.publishedAt.toLocaleDateString("fa-IR")}</time>
              {post.readingTime ? <><span aria-hidden="true">•</span><span>{post.readingTime.toLocaleString("fa-IR")} دقیقه مطالعه</span></> : null}
            </div>
            <h1 className="mt-2 text-2xl font-black leading-[1.7] tracking-tight text-foreground">{post.title}</h1>
            {post.excerpt ? <p className="mt-3 text-sm leading-8 text-muted-foreground">{post.excerpt}</p> : null}
          </div>

          {/* ==============================================================
              Article body
              
              No permanent desktop TOC.
              ArticleReadingExperience still receives headings and its
              TOC button opens the sheet/modal.
          =============================================================== */}

          <div className="article-reading-layout" dir="rtl">
            <main
              id="article-content-column"
              dir="rtl"
              className="
                article-content-column
                min-w-0
              "
            >
              <BlogContentRenderer content={preparedContent.html} />
            </main>
          </div>

          {/* ==============================================================
              Related content
          =============================================================== */}

          <div
            data-reading-extras
            className="
              mx-auto
              mt-16
              max-w-6xl
              sm:mt-20
            "
          >
            {/* Related entities */}
            {/* ==============================================================
    Related content
=============================================================== */}

            <div
              data-reading-extras
              className="
    mx-auto
    mt-16
    max-w-6xl
    sm:mt-20
  "
            >
              {/* Related entities */}
              <section>
                <div className="mb-6">
                  <p className="text-[11px] font-bold text-primary">
                    بیشتر در قفسه
                  </p>

                  <h2
                    className="
          mt-1.5
          text-2xl
          font-black
          tracking-tight
          text-foreground
          sm:text-3xl
        "
                  >
                    مرتبط با این نوشته
                  </h2>
                </div>

                <MagazineRelatedEntities entities={relatedEntities} />
              </section>

              {/* Related articles */}
              {relatedPosts.length > 0 ? (
                <section className="mt-14 sm:mt-16">
                  <div className="mb-6">
                    <p className="text-[11px] font-bold text-primary">
                      ادامه خواندن
                    </p>

                    <h2
                      className="
            mt-1.5
            text-2xl
            font-black
            tracking-tight
            text-foreground
            sm:text-3xl
          "
                    >
                      مطالب مرتبط
                    </h2>
                  </div>

                  <div
                    className="
          grid
          gap-5
          sm:grid-cols-2
          xl:grid-cols-3
        "
                  >
                    {relatedPosts.map((item) => (
                      <BlogCard key={item.id} post={item} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

          </div>
        </ArticleReadingExperience>
      </article>
    </PublicShell>
  );
}
