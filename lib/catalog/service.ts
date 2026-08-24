import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { Book, BookEdition, CatalogBook } from "@/db/schema";
import {
  ensureCatalogBookSlug,
  generateUniqueCatalogBookSlug,
} from "@/lib/book/public-slug";
import { slugify } from "@/lib/book/slug";
import { resolveDisplayEdition } from "@/lib/book/primary-edition";
import { splitStoredGenres } from "@/lib/book/genres";
import type { AddToLibraryInput, ManualBookInput } from "@/lib/validations/catalog";
import { ensureReferenceItem } from "@/lib/reference/service";
import { searchPublicBooks } from "@/lib/book/search-service";

/** خطای کنترل‌شده‌ی کاتالوگ که route handler آن را به پاسخ HTTP تبدیل می‌کند. */
export class CatalogError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
    this.name = "CatalogError";
  }
}

export interface CatalogEditionDTO {
  id: string;
  translator: string | null;
  publisher: string | null;
  isbn: string | null;
  format: "PHYSICAL" | "ELECTRONIC";
  coverImage: string | null;
  publishedYear: number | null;
  editionLabel: string | null;
  pageCount: number | null;
  language: string | null;
}

export interface CatalogBookDTO {
  id: string;
  title: string;
  author: string;
  description: string | null;
  genre: string | null;
  country: string | null;
  language: string | null;
  editions: CatalogEditionDTO[];
}

/**
 * جست‌وجوی کاتالوگ سراسری بر اساس عنوان/نویسنده/ژانر (کتاب کانونی)
 * و مترجم/ناشر/شابک (نسخه‌ها). نتایج بر اساس کتاب کانونی گروه‌بندی می‌شوند.
 */
export async function searchCatalog(
  rawQuery: string,
  limit = 20
): Promise<CatalogBookDTO[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const matches = await searchPublicBooks(q, limit);
  const rankedIds = matches.map((match) => match.id);
  if (rankedIds.length === 0) return [];

  const rows = await db
    .select({
      bookId: CatalogBook.id,
      primaryEditionId: CatalogBook.primaryEditionId,
      title: CatalogBook.title,
      author: CatalogBook.author,
      description: CatalogBook.description,
      genre: CatalogBook.genre,
      country: CatalogBook.country,
      bookLanguage: CatalogBook.language,
      createdAt: CatalogBook.createdAt,
      editionId: BookEdition.id,
      editionStatus: BookEdition.status,
      translator: BookEdition.translator,
      publisher: BookEdition.publisher,
      isbn: BookEdition.isbn,
      format: BookEdition.format,
      coverImage: BookEdition.coverImage,
      publishedYear: BookEdition.publishedYear,
      editionLabel: BookEdition.editionLabel,
      pageCount: BookEdition.pageCount,
      editionLanguage: BookEdition.language,
      editionCreatedAt: BookEdition.createdAt,
    })
    .from(CatalogBook)
    .leftJoin(BookEdition, eq(BookEdition.catalogBookId, CatalogBook.id))
    .where(
      and(
        eq(CatalogBook.status, "APPROVED"),
        inArray(CatalogBook.id, rankedIds),
      )
    )
    .orderBy(desc(CatalogBook.createdAt))
    .limit(200);

  // گروه‌بندی ردیف‌ها بر اساس کتاب کانونی
  const map = new Map<string, CatalogBookDTO>();
  const primaryEditionMap = new Map<string, string | null>();
  for (const r of rows) {
    primaryEditionMap.set(r.bookId, r.primaryEditionId);
    let book = map.get(r.bookId);
    if (!book) {
      if (map.size >= limit) continue;
      book = {
        id: r.bookId,
        title: r.title,
        author: r.author,
        description: r.description,
        genre: r.genre,
        country: r.country,
        language: r.bookLanguage,
        editions: [],
      };
      map.set(r.bookId, book);
    }
    // فقط نسخه‌های تأییدشده در نتایج عمومی نمایش داده می‌شوند
    if (r.editionId && r.editionStatus === "APPROVED") {
      book.editions.push({
        id: r.editionId,
        translator: r.translator,
        publisher: r.publisher,
        isbn: r.isbn,
        format: r.format as "PHYSICAL" | "ELECTRONIC",
        coverImage: r.coverImage,
        publishedYear: r.publishedYear,
        editionLabel: r.editionLabel,
        pageCount: r.pageCount,
        language: r.editionLanguage,
      });
    }
  }

  for (const book of map.values()) {
    const primaryEdition = resolveDisplayEdition(
      primaryEditionMap.get(book.id),
      book.editions.map((edition, index) => ({
        ...edition,
        createdAt: rows.find((row) => row.bookId === book.id && row.editionId === edition.id)?.editionCreatedAt ?? null,
        status: "APPROVED" as const,
        index,
      })),
    );

    if (primaryEdition) {
      book.editions.sort((a, b) => {
        if (a.id === primaryEdition.id) return -1;
        if (b.id === primaryEdition.id) return 1;
        return 0;
      });
    }
  }

  return rankedIds.flatMap((id) => {
    const book = map.get(id);
    return book ? [book] : [];
  });
}

/**
 * افزودن یک نسخه‌ی موجود کاتالوگ به کتابخانه‌ی کاربر.
 * داده‌های نسخه/کتاب در ردیف Book کپی می‌شوند تا ردیف کتابخانه خودبسنده بماند،
 * و پیوند editionId/catalogBookId هم ذخیره می‌شود.
 */
export async function addEditionToLibrary(
  userId: string,
  input: AddToLibraryInput
) {
  const [row] = await db
    .select({
      editionId: BookEdition.id,
      translator: BookEdition.translator,
      publisher: BookEdition.publisher,
      format: BookEdition.format,
      coverImage: BookEdition.coverImage,
      pageCount: BookEdition.pageCount,
      catalogBookId: CatalogBook.id,
      catalogBookSlug: CatalogBook.slug,
      title: CatalogBook.title,
      author: CatalogBook.author,
      description: CatalogBook.description,
      genre: CatalogBook.genre,
      country: CatalogBook.country,
    })
    .from(BookEdition)
    .innerJoin(CatalogBook, eq(BookEdition.catalogBookId, CatalogBook.id))
    .where(eq(BookEdition.id, input.editionId));

  if (!row) {
    throw new CatalogError("نسخه‌ی موردنظر یافت نشد", 404, "EDITION_NOT_FOUND");
  }

  // جلوگیری از افزودن تکراری همان نسخه برای همان کاربر
  const [existing] = await db
    .select({ id: Book.id })
    .from(Book)
    .where(and(eq(Book.userId, userId), eq(Book.editionId, input.editionId)));

  if (existing) {
    throw new CatalogError(
      "این نسخه از قبل در کتابخانه‌ی شماست",
      409,
      "ALREADY_IN_LIBRARY"
    );
  }

  const [book] = await db
    .insert(Book)
    .values({
      title: row.title,
      author: row.author,
      description: row.description,
      genre: row.genre ?? "نامشخص",
      country: row.country,
      coverImage: row.coverImage ?? null,
      translator: row.translator,
      publisher: row.publisher,
      pageCount: row.pageCount,
      format: row.format,
      userId,
      status: input.status,
      rating: input.rating,
      review: input.notes,
      catalogBookId: row.catalogBookId,
      editionId: row.editionId,
    })
    .returning({ id: Book.id, title: Book.title });

  return {
    ...book,
    slug: await ensureCatalogBookSlug({
      id: row.catalogBookId,
      title: row.title,
      slug: row.catalogBookSlug,
    }),
  };
}

/**
 * ساخت دستی: اگر کتاب کانونی مشابهی نبود ساخته می‌شود، سپس یک نسخه‌ی جدید
 * و در نهایت ردیف کتابخانه‌ی کاربر — همه در یک تراکنش.
 */
export async function createManualBook(userId: string, input: ManualBookInput) {
  const cover = input.coverImage ?? null;

  const book = await db.transaction(async (tx) => {
    // تطبیق ساده‌ی کتاب کانونی بر اساس عنوان+نویسنده (بدون حساسیت به حروف)
    const [match] = await tx
      .select({ id: CatalogBook.id })
      .from(CatalogBook)
      .where(
        and(
          sql`lower(${CatalogBook.title}) = lower(${input.title})`,
          sql`lower(${CatalogBook.author}) = lower(${input.author})`
        )
      )
      .limit(1);

    let catalogBookId = match?.id;

    if (!catalogBookId) {
      const nextCatalogBookId = crypto.randomUUID();
      const slug = await generateUniqueCatalogBookSlug(
        input.title,
        nextCatalogBookId,
      );
      // کتاب کانونیِ تازه به‌صورت در انتظار تأیید ساخته می‌شود
      const [created] = await tx
        .insert(CatalogBook)
        .values({
          id: nextCatalogBookId,
          title: input.title,
          slug,
          slugNormalized: slugify(slug),
          originalTitle: input.originalTitle,
          description: input.description,
          coverImage: cover,
          author: input.author,
          genre: input.genre,
          country: input.country,
          language: input.language,
          status: "PENDING",
          createdById: userId,
        })
        .returning({ id: CatalogBook.id });
      catalogBookId = created.id;
    }

    // نسخه‌ی تازه همیشه در انتظار تأیید است
    const [edition] = await tx
      .insert(BookEdition)
      .values({
        catalogBookId,
        translator: input.translator,
        publisher: input.publisher,
        isbn: input.isbn,
        format: input.format,
        coverImage: cover,
        publishedYear: input.publishedYear,
        editionLabel: input.editionLabel,
        pageCount: input.pageCount,
        language: input.language,
        status: "PENDING",
        createdById: userId,
      })
      .returning({ id: BookEdition.id });

    // ردیف کتابخانه‌ی کاربر بلافاصله ساخته می‌شود (مستقل از تأیید کاتالوگ)
    const [created] = await tx
      .insert(Book)
      .values({
        title: input.title,
        author: input.author,
        description: input.description,
        genre: input.genre,
        country: input.country,
        coverImage: cover,
        translator: input.translator,
        publisher: input.publisher,
        pageCount: input.pageCount,
        format: input.format,
        userId,
        status: input.status,
        rating: input.rating,
        review: input.notes,
        catalogBookId,
        editionId: edition.id,
      })
      .returning({ id: Book.id, title: Book.title });

    return {
      ...created,
      slug: await ensureCatalogBookSlug({
        id: catalogBookId,
        title: input.title,
        slug: null,
      }),
    };
  });

  // پیشنهاد مقادیر مرجع جدید (PENDING) — مستقل و بدون شکست‌دادن ساخت کتاب
  try {
    await Promise.all([
      ensureReferenceItem("AUTHOR", input.author, userId),
      ...splitStoredGenres(input.genre).map((genre) =>
        ensureReferenceItem("GENRE", genre, userId),
      ),
      input.translator
        ? ensureReferenceItem("TRANSLATOR", input.translator, userId)
        : Promise.resolve(),
      input.publisher
        ? ensureReferenceItem("PUBLISHER", input.publisher, userId)
        : Promise.resolve(),
      input.country
        ? ensureReferenceItem("COUNTRY", input.country, userId)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("reference ensure (manual book) failed:", err);
  }

  return book;
}
