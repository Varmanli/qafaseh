/**
 * Local-only fixtures for visually testing archive pagination.
 *
 * The script only creates deterministic records and reuses image URLs already
 * stored in the local database. `--clean` removes exactly those records.
 */
import { and, asc, eq, inArray, isNotNull, ne } from "drizzle-orm";

import { db, pool } from "@/db";
import {
  BlogCategory,
  BlogPost,
  Book,
  BookSearchIndex,
  CatalogBook,
  CatalogBookContributor,
  ReferenceItem,
} from "@/db/schema";

const MARKER = "[TEST:pagination]";
const BOOK_COUNT = 180;
const AUTHOR_COUNT = 120;
const ARTICLE_COUNT = 63;
const BASE_DATE = new Date("2024-01-01T12:00:00.000Z");

const bookId = (index: number) => `pagination-test-book-${String(index).padStart(3, "0")}`;
const authorId = (index: number) => `pagination-test-author-${String(index).padStart(3, "0")}`;
const articleId = (index: number) => `pagination-test-article-${String(index).padStart(3, "0")}`;

const bookIds = Array.from({ length: BOOK_COUNT }, (_, index) => bookId(index + 1));
const authorIds = Array.from({ length: AUTHOR_COUNT }, (_, index) => authorId(index + 1));
const articleIds = Array.from({ length: ARTICLE_COUNT }, (_, index) => articleId(index + 1));

function assertLocalDevelopmentDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[pagination-seed] Refusing to run in production.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("[pagination-seed] DATABASE_URL is required.");

  const hostname = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error(
      `[pagination-seed] Refusing non-local database host \"${hostname}\".`,
    );
  }
}

async function removePaginationFixtures() {
  await db.transaction(async (tx) => {
    await tx.delete(BlogPost).where(inArray(BlogPost.id, articleIds));
    // The catalog search-index trigger reads contributors during a catalog
    // delete, so fixture-only dependent rows must go first.
    await tx.delete(CatalogBookContributor).where(inArray(CatalogBookContributor.catalogBookId, bookIds));
    await tx.delete(BookSearchIndex).where(inArray(BookSearchIndex.catalogBookId, bookIds));
    await tx.delete(CatalogBook).where(inArray(CatalogBook.id, bookIds));
    await tx.delete(ReferenceItem).where(inArray(ReferenceItem.id, authorIds));
  });
}

async function loadReusableImages() {
  const [catalogBookCovers, personalBookCovers, authorImages, articleImages, categories] = await Promise.all([
    db.select({ image: CatalogBook.coverImage })
      .from(CatalogBook)
      .where(and(eq(CatalogBook.status, "APPROVED"), isNotNull(CatalogBook.coverImage), ne(CatalogBook.coverImage, "")))
      .orderBy(asc(CatalogBook.id))
      .limit(12),
    db.select({ image: Book.coverImage })
      .from(Book)
      .where(and(isNotNull(Book.coverImage), ne(Book.coverImage, "")))
      .orderBy(asc(Book.id))
      .limit(12),
    db.select({ image: ReferenceItem.coverImage })
      .from(ReferenceItem)
      .where(and(eq(ReferenceItem.type, "AUTHOR"), eq(ReferenceItem.status, "APPROVED"), isNotNull(ReferenceItem.coverImage), ne(ReferenceItem.coverImage, "")))
      .orderBy(asc(ReferenceItem.id))
      .limit(12),
    db.select({ image: BlogPost.bannerImage })
      .from(BlogPost)
      .where(and(eq(BlogPost.status, "PUBLISHED"), isNotNull(BlogPost.bannerImage), ne(BlogPost.bannerImage, "")))
      .orderBy(asc(BlogPost.id))
      .limit(12),
    db.select({ id: BlogCategory.id, name: BlogCategory.name })
      .from(BlogCategory)
      .orderBy(asc(BlogCategory.name)),
  ]);

  const bookCovers = [...catalogBookCovers, ...personalBookCovers];
  if (!bookCovers.length || !authorImages.length || !articleImages.length || !categories.length) {
    throw new Error(
      "[pagination-seed] Existing book covers, approved author images, article images, and categories are required before seeding.",
    );
  }

  return {
    bookCovers: bookCovers.map((row) => row.image!),
    authorImages: authorImages.map((row) => row.image!),
    articleImages: articleImages.map((row) => row.image!),
    categories,
  };
}

async function seedPaginationFixtures() {
  const images = await loadReusableImages();
  await removePaginationFixtures();

  await db.transaction(async (tx) => {
    await tx.insert(ReferenceItem).values(
      Array.from({ length: AUTHOR_COUNT }, (_, index) => {
        const number = index + 1;
        const slug = `test-pagination-author-${String(number).padStart(3, "0")}`;
        return {
          id: authorId(number),
          type: "AUTHOR" as const,
          name: `${MARKER} نویسنده آزمایشی ${number.toLocaleString("fa-IR")}`,
          slug,
          slugNormalized: slug,
          coverImage: images.authorImages[index % images.authorImages.length],
          countryName: index % 3 === 0 ? "ایران" : index % 3 === 1 ? "فرانسه" : "روسیه",
          description: "نویسندهٔ آزمایشی برای بررسی صفحه‌بندی در محیط توسعه.",
          sourceName: "qafaseh-pagination-test",
          status: "APPROVED" as const,
          createdAt: new Date(BASE_DATE.getTime() + index * 86_400_000),
          updatedAt: new Date(BASE_DATE.getTime() + index * 86_400_000),
        };
      }),
    );

    await tx.insert(CatalogBook).values(
      Array.from({ length: BOOK_COUNT }, (_, index) => {
        const number = index + 1;
        const slug = `test-pagination-book-${String(number).padStart(3, "0")}`;
        const authorNumber = (index % AUTHOR_COUNT) + 1;
        return {
          id: bookId(number),
          title: `${MARKER} کتاب آزمایشی ${number.toLocaleString("fa-IR")}`,
          slug,
          slugNormalized: slug,
          author: `${MARKER} نویسنده آزمایشی ${authorNumber.toLocaleString("fa-IR")}`,
          description: "کتاب آزمایشی برای بررسی صفحه‌بندی آرشیو در محیط توسعه.",
          coverImage: images.bookCovers[index % images.bookCovers.length],
          genre: index % 2 === 0 ? "داستان" : "ادبیات",
          country: index % 3 === 0 ? "ایران" : index % 3 === 1 ? "فرانسه" : "روسیه",
          language: "فارسی",
          firstPublishedYear: 1380 + (index % 40),
          sourceName: "qafaseh-pagination-test",
          status: "APPROVED" as const,
          createdAt: new Date(BASE_DATE.getTime() + index * 86_400_000),
          updatedAt: new Date(BASE_DATE.getTime() + index * 86_400_000),
        };
      }),
    );

    await tx.insert(CatalogBookContributor).values(
      Array.from({ length: BOOK_COUNT }, (_, index) => ({
        catalogBookId: bookId(index + 1),
        referenceItemId: authorId((index % AUTHOR_COUNT) + 1),
        role: "AUTHOR" as const,
        sortOrder: 0,
        sourceName: "qafaseh-pagination-test",
      })),
    );

    await tx.insert(BlogPost).values(
      Array.from({ length: ARTICLE_COUNT }, (_, index) => {
        const number = index + 1;
        const slug = `test-pagination-article-${String(number).padStart(3, "0")}`;
        const timestamp = new Date(BASE_DATE.getTime() + index * 86_400_000);
        return {
          id: articleId(number),
          title: `${MARKER} مقاله آزمایشی ${number.toLocaleString("fa-IR")}`,
          slug,
          // Keep three real topics populated enough to exercise filtered
          // magazine pagination as well as the all-articles archive.
          categoryId: images.categories[index % Math.min(3, images.categories.length)].id,
          excerpt: "مطلب آزمایشی کوتاه برای بررسی صفحه‌بندی مجله در محیط توسعه.",
          content: `<p>${MARKER} محتوای آزمایشی مقاله ${number.toLocaleString("fa-IR")} برای تست آرشیو مجله.</p>`,
          bannerImage: images.articleImages[index % images.articleImages.length],
          status: "PUBLISHED" as const,
          publishedAt: timestamp,
          readingTime: 3 + (index % 8),
          seoTitle: `${MARKER} seed`,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      }),
    );
  });

  console.log(`[pagination-seed] Created ${BOOK_COUNT} books, ${AUTHOR_COUNT} authors, and ${ARTICLE_COUNT} articles.`);
  console.log("[pagination-seed] Reused existing local database image values; no files or external URLs were created.");
}

async function main() {
  assertLocalDevelopmentDatabase();
  if (process.argv.includes("--clean")) {
    await removePaginationFixtures();
    console.log("[pagination-seed] Removed pagination test fixtures.");
  } else {
    await seedPaginationFixtures();
  }
  await pool.end();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
