import type { MetadataRoute } from "next";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { BlogCategory, BlogPost, CatalogBook, ReferenceItem, StaticPage } from "@/db/schema";
import { ensureCatalogBookSlug } from "@/lib/book/public-slug";
import { getReadingListsOverview } from "@/lib/book/reading-lists-service";
import { getSiteOrigin } from "@/lib/seo/site";

const STATIC_PUBLIC_ROUTES = [
  "",
  "/discover",
  "/lists",
  "/books",
  "/authors",
  "/translators",
  "/publishers",
  "/blog",
] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteOrigin = getSiteOrigin();

  let catalogBooks: { id: string; slug: string | null; title: string; updatedAt: Date }[] = [];
  let references: { type: "AUTHOR" | "TRANSLATOR" | "PUBLISHER" | "COUNTRY" | "GENRE"; slug: string | null; updatedAt: Date }[] = [];
  let blogPosts: { slug: string; updatedAt: Date; publishedAt: Date | null }[] = [];
  let blogCategories: { slug: string; updatedAt: Date }[] = [];
  let staticPages: { slug: string; updatedAt: Date }[] = [];

  try {
    [catalogBooks, references, blogPosts, blogCategories, staticPages] = await Promise.all([
      db
        .select({
          id: CatalogBook.id,
          slug: CatalogBook.slug,
          title: CatalogBook.title,
          updatedAt: CatalogBook.updatedAt,
        })
        .from(CatalogBook)
        .where(eq(CatalogBook.status, "APPROVED")),
      db
        .select({
          type: ReferenceItem.type,
          slug: ReferenceItem.slug,
          updatedAt: ReferenceItem.updatedAt,
        })
        .from(ReferenceItem)
        .where(and(eq(ReferenceItem.status, "APPROVED"), isNotNull(ReferenceItem.slug))),
      db
        .select({
          slug: BlogPost.slug,
          updatedAt: BlogPost.updatedAt,
          publishedAt: BlogPost.publishedAt,
        })
        .from(BlogPost)
        .where(and(eq(BlogPost.status, "PUBLISHED"), isNotNull(BlogPost.publishedAt))),
      db
        .selectDistinct({ slug: BlogCategory.slug, updatedAt: BlogCategory.updatedAt })
        .from(BlogCategory)
        .innerJoin(BlogPost, eq(BlogPost.categoryId, BlogCategory.id))
        .where(and(eq(BlogPost.status, "PUBLISHED"), isNotNull(BlogPost.publishedAt))),
      db
        .select({
          slug: StaticPage.slug,
          updatedAt: StaticPage.updatedAt,
        })
        .from(StaticPage)
        .where(eq(StaticPage.status, "PUBLISHED")),
    ]);
  } catch (error) {
    console.warn("Sitemap: Failed to query database during render/build, returning static routes.", error);
  }

  const bookEntries = await Promise.all(
    catalogBooks.map(async (book) => ({
      url: `${siteOrigin}/book/${encodeURIComponent(
        await ensureCatalogBookSlug({
          id: book.id,
          title: book.title,
          slug: book.slug,
        }),
      )}`,
      lastModified: book.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  );

  const referenceRouteByType = {
    AUTHOR: "authors",
    TRANSLATOR: "translators",
    PUBLISHER: "publishers",
    COUNTRY: "countries",
    GENRE: "genres",
  } as const;

  const publicLists = await getReadingListsOverview();

  return [
    ...STATIC_PUBLIC_ROUTES.map((route) => ({
      url: `${siteOrigin}${route || "/"}`,
      lastModified: new Date(),
      changeFrequency: route === "" ? "daily" as const : "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...bookEntries,
    ...publicLists.map((list) => ({
      url: `${siteOrigin}/lists/${list.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...references.map((item) => ({
      url: `${siteOrigin}/${referenceRouteByType[item.type]}/${encodeURIComponent(
        item.slug as string,
      )}`,
      lastModified: item.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...blogPosts.map((post) => ({
      url: `${siteOrigin}/blog/${encodeURIComponent(post.slug)}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...blogCategories.map((category) => ({
      url: `${siteOrigin}/blog/category/${encodeURIComponent(category.slug)}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...staticPages.map((page) => ({
      url: `${siteOrigin}/${encodeURIComponent(page.slug)}`,
      lastModified: page.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
