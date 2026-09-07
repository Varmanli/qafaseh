import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  Book,
  BookEdition,
  CatalogBook,
  PublishedBookNote,
  Quote,
  ReferenceItem,
  User,
} from "@/db/schema";
import { generateUniqueCatalogBookSlug } from "@/lib/book/public-slug";
import { slugify } from "@/lib/book/slug";
import { coalesceCoverImage } from "@/lib/book/cover";
import { resolveBookDisplayData } from "@/lib/book/display-cover";
import { splitStoredGenres } from "@/lib/book/genres";
import {
  listBookExternalLinks,
  upsertBookExternalLinks,
  type AdminExternalLink,
} from "@/lib/book/external-links";
import {
  preferredEditionFieldSql,
  resolveDisplayEdition,
} from "@/lib/book/primary-edition";
import { adminCreateReference } from "@/lib/reference/service";
import type {
  AdminEditionCreateInput,
  AdminPrimaryEditionInput,
  AdminEditionUpdateInput,
  AdminBookUpdateInput,
  ManualBookInput,
} from "@/lib/validations/catalog";
import type { ExternalLinkInput } from "@/lib/validations/external-links";
import { compareEditionSets, findDuplicateEditionIds } from "@/lib/admin/edition-set-invariants";

export interface PendingEditionDTO {
  id: string;
  translator: string | null;
  publisher: string | null;
  isbn: string | null;
  format: string;
  publishedYear: number | null;
  editionLabel: string | null;
  pageCount: number | null;
  coverImage: string | null;
}

export interface PendingCatalogDTO {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  description: string | null;
  createdByName: string | null;
  createdAt: Date;
  editions: PendingEditionDTO[];
}

/** فهرست کتاب‌های کاتالوگ در انتظار تأیید، همراه با نسخه‌ها و سازنده. */
export async function listPendingCatalog(): Promise<PendingCatalogDTO[]> {
  const rows = await db
    .select({
      id: CatalogBook.id,
      title: CatalogBook.title,
      author: CatalogBook.author,
      genre: CatalogBook.genre,
      description: CatalogBook.description,
      createdAt: CatalogBook.createdAt,
      createdByName: User.name,
      editionId: BookEdition.id,
      translator: BookEdition.translator,
      publisher: BookEdition.publisher,
      isbn: BookEdition.isbn,
      format: BookEdition.format,
      publishedYear: BookEdition.publishedYear,
      editionLabel: BookEdition.editionLabel,
      pageCount: BookEdition.pageCount,
      coverImage: BookEdition.coverImage,
    })
    .from(CatalogBook)
    .leftJoin(BookEdition, eq(BookEdition.catalogBookId, CatalogBook.id))
    .leftJoin(User, eq(CatalogBook.createdById, User.id))
    .where(eq(CatalogBook.status, "PENDING"))
    .orderBy(desc(CatalogBook.createdAt))
    .limit(300);

  const map = new Map<string, PendingCatalogDTO>();
  for (const r of rows) {
    let book = map.get(r.id);
    if (!book) {
      book = {
        id: r.id,
        title: r.title,
        author: r.author,
        genre: r.genre,
        description: r.description,
        createdByName: r.createdByName,
        createdAt: r.createdAt,
        editions: [],
      };
      map.set(r.id, book);
    }
    if (r.editionId) {
      book.editions.push({
        id: r.editionId,
        translator: r.translator,
        publisher: r.publisher,
        isbn: r.isbn,
        format: r.format ?? "PHYSICAL",
        publishedYear: r.publishedYear,
        editionLabel: r.editionLabel,
        pageCount: r.pageCount,
        coverImage: r.coverImage,
      });
    }
  }
  return Array.from(map.values());
}

/**
 * تأیید/رد یک کتاب کاتالوگ؛ وضعیت نسخه‌های در انتظارِ همان کتاب هم هم‌سو می‌شود.
 * ردیف‌های کتابخانه‌ی کاربران دست‌نخورده می‌مانند.
 */
export async function setCatalogStatus(
  bookId: string,
  status: "APPROVED" | "REJECTED"
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(CatalogBook)
      .set({ status, updatedAt: new Date() })
      .where(eq(CatalogBook.id, bookId));

    await tx
      .update(BookEdition)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(BookEdition.catalogBookId, bookId),
          inArray(BookEdition.status, ["PENDING"])
        )
      );
  });
}

/** ویرایش اختیاری متادیتای کتاب کاتالوگ پیش از تأیید. */
export async function updateCatalogMetadata(
  bookId: string,
  input: {
    title?: string;
    author?: string;
    genre?: string;
    description?: string;
  }
): Promise<void> {
  const set: Partial<typeof CatalogBook.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = input.title.trim();
  if (input.author !== undefined) set.author = input.author.trim();
  if (input.genre !== undefined) set.genre = input.genre.trim();
  if (input.description !== undefined) set.description = input.description.trim();
  await db.update(CatalogBook).set(set).where(eq(CatalogBook.id, bookId));
}

const COUNT = sql<number>`count(*)::int`;

// ---------------- داشبورد ----------------
export interface AdminOverview {
  counts: {
    users: number;
    books: number;
    pendingBooks: number;
    pendingReferences: number;
    quotes: number;
    notes: number;
  };
  recentUsers: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    createdAt: Date;
  }[];
  recentBooks: {
    id: string;
    title: string;
    author: string;
    status: string;
    createdAt: Date;
  }[];
  recentPending: {
    id: string;
    title: string;
    author: string;
    createdAt: Date;
  }[];
  recentActivities: {
    id: string;
    userName: string;
    action: string;
    target: string;
    createdAt: Date;
  }[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    [users],
    [books],
    [pendingBooks],
    [pendingReferences],
    [quotes],
    [notes],
    recentUsers,
    recentBooks,
    recentPending,
    recentActivities,
  ] = await Promise.all([
    db.select({ c: COUNT }).from(User),
    db.select({ c: COUNT }).from(CatalogBook),
    db
      .select({ c: COUNT })
      .from(CatalogBook)
      .where(eq(CatalogBook.status, "PENDING")),
    db
      .select({ c: COUNT })
      .from(ReferenceItem)
      .where(eq(ReferenceItem.status, "PENDING")),
    db.select({ c: COUNT }).from(Quote),
    db.select({ c: COUNT }).from(PublishedBookNote),
    db
      .select({
        id: User.id,
        name: User.name,
        username: User.username,
        image: User.image,
        createdAt: User.createdAt,
      })
      .from(User)
      .orderBy(desc(User.createdAt))
      .limit(6),
    db
      .select({
        id: CatalogBook.id,
        title: CatalogBook.title,
        author: CatalogBook.author,
        status: CatalogBook.status,
        createdAt: CatalogBook.createdAt,
      })
      .from(CatalogBook)
      .orderBy(desc(CatalogBook.createdAt))
      .limit(6),
    db
      .select({
        id: CatalogBook.id,
        title: CatalogBook.title,
        author: CatalogBook.author,
        createdAt: CatalogBook.createdAt,
      })
      .from(CatalogBook)
      .where(eq(CatalogBook.status, "PENDING"))
      .orderBy(desc(CatalogBook.createdAt))
      .limit(6),
    db.execute<{
      id: string;
      user_name: string;
      action: string;
      target: string;
      created_at: Date;
    }>(sql`
      SELECT id, user_name, action, target, created_at FROM (
        SELECT b.id, COALESCE(u.name, u.username, 'کاربر') AS user_name,
          CASE WHEN b.review IS NOT NULL AND b.review <> '' THEN 'یک ریویو ثبت کرد' ELSE 'کتابی به کتابخانه اضافه کرد' END AS action,
          b.title AS target, b.created_at
        FROM "Book" b JOIN "User" u ON u.id = b.user_id
        UNION ALL
        SELECT q.id, COALESCE(u.name, u.username, 'کاربر'), 'یک تکه‌کتاب ثبت کرد', COALESCE(cb.title, b.title, 'کتاب'), q.created_at
        FROM "Quote" q JOIN "User" u ON u.id = q.user_id LEFT JOIN "CatalogBook" cb ON cb.id = q.catalog_book_id LEFT JOIN "Book" b ON b.id = q.book_id
        UNION ALL
        SELECT n.id, COALESCE(u.name, u.username, 'کاربر'), 'یک یادداشت منتشر کرد', COALESCE(cb.title, b.title, 'کتاب'), n.created_at
        FROM "PublishedBookNote" n JOIN "User" u ON u.id = n.user_id LEFT JOIN "CatalogBook" cb ON cb.id = n.catalog_book_id LEFT JOIN "Book" b ON b.id = n.book_id
      ) activity ORDER BY created_at DESC LIMIT 6
    `),
  ]);

  return {
    counts: {
      users: users?.c ?? 0,
      books: books?.c ?? 0,
      pendingBooks: pendingBooks?.c ?? 0,
      pendingReferences: pendingReferences?.c ?? 0,
      quotes: quotes?.c ?? 0,
      notes: notes?.c ?? 0,
    },
    recentUsers,
    recentBooks,
    recentPending,
    recentActivities: recentActivities.rows.map((activity) => ({
      id: activity.id,
      userName: activity.user_name,
      action: activity.action,
      target: activity.target,
      createdAt: activity.created_at,
    })),
  };
}

// ---------------- مدیریت کاربران ----------------
export interface AdminUserRow {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  createdAt: Date;
  bookCount: number;
}

export async function adminListUsers(opts: {
  q?: string;
  role?: "USER" | "ADMIN";
  limit?: number;
  offset?: number;
}): Promise<{ users: AdminUserRow[]; total: number }> {
  const conds = [];
  if (opts.q?.trim()) {
    const term = `%${opts.q.trim()}%`;
    conds.push(
      or(
        ilike(User.name, term),
        ilike(User.email, term),
        ilike(User.username, term)
      )
    );
  }
  if (opts.role) conds.push(eq(User.role, opts.role));
  const where = conds.length ? and(...conds) : undefined;

  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: User.id,
        name: User.name,
        username: User.username,
        email: User.email,
        image: User.image,
        role: User.role,
        createdAt: User.createdAt,
        bookCount: sql<number>`count(${Book.id})::int`,
      })
      .from(User)
      .leftJoin(Book, eq(Book.userId, User.id))
      .where(where)
      .groupBy(User.id)
      .orderBy(desc(User.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ c: COUNT }).from(User).where(where),
  ]);

  return { users: rows as AdminUserRow[], total: totalRow?.c ?? 0 };
}

export async function adminSetUserRole(
  userId: string,
  role: "USER" | "ADMIN"
): Promise<void> {
  await db
    .update(User)
    .set({ role, updatedAt: new Date() })
    .where(eq(User.id, userId));
}

// ---------------- مدیریت کتاب‌های کاتالوگ ----------------
export interface AdminBookRow {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  primaryEditionId: string | null;
  primaryEditionLabel: string | null;
  primaryEditionPublisher: string | null;
  coverImage: string | null;
  editionCount: number;
  linkCount: number;
  libraryCount: number;
  createdByName: string | null;
  createdAt: Date;
}

export async function adminListCatalogBooks(opts: {
  q?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  limit?: number;
  offset?: number;
}): Promise<{ books: AdminBookRow[]; total: number }> {
  const conds = [];
  if (opts.q?.trim()) {
    const term = `%${opts.q.trim()}%`;
    conds.push(or(ilike(CatalogBook.title, term), ilike(CatalogBook.author, term)));
  }
  if (opts.status) conds.push(eq(CatalogBook.status, opts.status));
  const where = conds.length ? and(...conds) : undefined;

  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: CatalogBook.id,
        title: CatalogBook.title,
        author: CatalogBook.author,
        genre: CatalogBook.genre,
        status: CatalogBook.status,
        primaryEditionId: CatalogBook.primaryEditionId,
        primaryEditionLabel: preferredEditionFieldSql<string | null>("edition_label", {
          approvedOnly: false,
        }),
        primaryEditionPublisher: preferredEditionFieldSql<string | null>("publisher", {
          approvedOnly: false,
        }),
        createdByName: User.name,
        createdAt: CatalogBook.createdAt,
        coverImage: sql<string | null>`coalesce(
          ${preferredEditionFieldSql<string | null>("cover_image")},
          ${CatalogBook.coverImage}
        )`,
        editionCount: sql<number>`count(${BookEdition.id})::int`,
        linkCount: sql<number>`(
          select count(*) from "BookExternalLink" bel
          where bel.catalog_book_id = ${CatalogBook.id}
        )::int`,
        libraryCount: sql<number>`count(distinct ${Book.id})::int`,
      })
      .from(CatalogBook)
      .leftJoin(BookEdition, eq(BookEdition.catalogBookId, CatalogBook.id))
      .leftJoin(Book, eq(Book.catalogBookId, CatalogBook.id))
      .leftJoin(User, eq(CatalogBook.createdById, User.id))
      .where(where)
      .groupBy(CatalogBook.id, User.id)
      .orderBy(desc(CatalogBook.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ c: COUNT }).from(CatalogBook).where(where),
  ]);

  return { books: rows as AdminBookRow[], total: totalRow?.c ?? 0 };
}

export async function setCatalogBookStatus(
  bookId: string,
  status: "APPROVED" | "REJECTED"
): Promise<void> {
  return setCatalogStatus(bookId, status);
}

export async function adminDeleteCatalogBook(bookId: string): Promise<void> {
  // BookEditions cascade; user library Book rows keep their copied fields and
  // only lose the catalog link (FK is set null on delete).
  await db.delete(CatalogBook).where(eq(CatalogBook.id, bookId));
}

/**
 * Admin-created catalog book + edition. Approved by default (admins are trusted).
 * Author/genre are also promoted to APPROVED reference items.
 */
export async function adminCreateCatalogBook(
  input: ManualBookInput,
  adminId: string,
  externalLinks?: ExternalLinkInput[]
): Promise<{ id: string; slug: string }> {
  const genres = splitStoredGenres(input.genre);
  const catalogId = crypto.randomUUID();
  const slug = await generateUniqueCatalogBookSlug(input.title, catalogId);

  const id = await db.transaction(async (tx) => {
    const editionId = crypto.randomUUID();
    const [book] = await tx
      .insert(CatalogBook)
      .values({
        id: catalogId,
        title: input.title,
        slug,
        slugNormalized: slugify(slug),
        originalTitle: input.originalTitle,
        description: input.description,
        coverImage: input.coverImage ?? null,
        author: input.author,
        genre: input.genre,
        country: input.country,
        language: input.language,
        status: "APPROVED",
        createdById: adminId,
      })
      .returning({ id: CatalogBook.id });

    await tx.insert(BookEdition).values({
      id: editionId,
      catalogBookId: book.id,
      translator: input.translator,
      publisher: input.publisher,
      isbn: input.isbn,
      format: input.format,
      coverImage: input.coverImage ?? null,
      publishedYear: input.publishedYear,
      editionLabel: input.editionLabel,
      pageCount: input.pageCount,
      language: input.language,
      status: "APPROVED",
      createdById: adminId,
    });

    await tx
      .update(CatalogBook)
      .set({ primaryEditionId: editionId, updatedAt: new Date() })
      .where(eq(CatalogBook.id, book.id));

    // لینک‌های بیرونی به هویت کانونی (catalogBookId) وصل می‌شوند، نه ردیف کاربر.
    if (externalLinks && externalLinks.length > 0) {
      await upsertBookExternalLinks(book.id, externalLinks, tx);
    }

    return book.id;
  });

  // Promote reference values (best-effort, non-blocking).
  try {
    await Promise.all([
      adminCreateReference("AUTHOR", input.author),
      ...genres.map((genre) => adminCreateReference("GENRE", genre)),
      input.translator
        ? adminCreateReference("TRANSLATOR", input.translator)
        : Promise.resolve(),
      input.publisher
        ? adminCreateReference("PUBLISHER", input.publisher)
        : Promise.resolve(),
      input.country
        ? adminCreateReference("COUNTRY", input.country)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("admin reference promote failed:", err);
  }

  return { id, slug };
}

// ---------------- جست‌وجوی کاتالوگ برای ادمین (انتخابگر صفحه‌ی اصلی و ...) ----------------

/** بهترین جلدِ نسخه‌ی تأییدشده برای یک کتاب کانونی (همان منطق آرشیو عمومی). */
function bestEditionCoverSql() {
  return preferredEditionFieldSql<string | null>("cover_image");
}

/** جلدِ یکی از ردیف‌های کتابخانه‌ی همان کتاب کانونی (آخرین لایه‌ی fallback). */
function sampleBookCoverSql() {
  return sql<string | null>`(
    select b.cover_image
    from "Book" b
    where b.catalog_book_id = ${CatalogBook.id}
      and b.cover_image is not null and trim(b.cover_image) <> ''
    order by b.created_at desc
    limit 1
  )`;
}

export interface AdminCatalogSearchResult {
  id: string;
  slug: string | null;
  title: string;
  originalTitle: string | null;
  author: string;
  coverImage: string | null;
  publisher: string | null;
  translator: string | null;
}

/**
 * جست‌وجوی کتاب‌های کاتالوگ برای ابزارهای ادمین (انتخابگر صفحه‌ی اصلی، و...).
 * هویت = CatalogBook (کانونی)؛ پس کتاب‌های ساخته‌شده توسط ادمین، کتاب‌های
 * تأییدشده‌ی کاربران و کتاب‌های واردشده همه دیده می‌شوند. جلد با همان زنجیره‌ی
 * fallbackِ آرشیو عمومی محاسبه می‌شود تا جلد شکسته نمایش داده نشود.
 */
export async function searchAdminCatalogBooks(
  rawQuery: string,
  opts: {
    limit?: number;
    statuses?: Array<"PENDING" | "APPROVED" | "REJECTED">;
  } = {},
): Promise<AdminCatalogSearchResult[]> {
  const limit = Math.min(opts.limit ?? 12, 50);
  const statuses = opts.statuses ?? ["APPROVED"];
  const q = rawQuery.trim();

  const conds = [inArray(CatalogBook.status, statuses)];
  if (q) {
    const term = `%${q}%`;
    conds.push(
      sql`(
        ${CatalogBook.title} ilike ${term}
        or ${CatalogBook.id} = ${q}
        or ${CatalogBook.originalTitle} ilike ${term}
        or ${CatalogBook.author} ilike ${term}
        or ${CatalogBook.slug} ilike ${term}
        or exists (
          select 1 from "BookEdition" be
          where be.catalog_book_id = ${CatalogBook.id}
            and (be.translator ilike ${term} or be.publisher ilike ${term})
        )
      )`,
    );
  }

  const rows = await db
    .select({
      id: CatalogBook.id,
      slug: CatalogBook.slug,
      title: CatalogBook.title,
      originalTitle: CatalogBook.originalTitle,
      author: CatalogBook.author,
      publisher: preferredEditionFieldSql<string | null>("publisher"),
      translator: preferredEditionFieldSql<string | null>("translator"),
      coverImage: sql<string | null>`coalesce(
        ${bestEditionCoverSql()},
        ${CatalogBook.coverImage},
        ${sampleBookCoverSql()}
      )`,
    })
    .from(CatalogBook)
    .where(and(...conds))
    .orderBy(desc(CatalogBook.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    originalTitle: row.originalTitle,
    author: row.author,
    coverImage: coalesceCoverImage(row.coverImage),
    publisher: row.publisher,
    translator: row.translator,
  }));
}

// ---------------- ویرایش ادمینیِ کتاب کاتالوگ ----------------
export interface AdminBookEditData {
  id: string;
  slug: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  title: string;
  originalTitle: string | null;
  author: string;
  genres: string[];
  description: string | null;
  country: string | null;
  language: string | null;
  coverImage: string | null;
  primaryEditionId: string | null;
  // فیلدهای نسخه‌ی نماینده
  editionId: string | null;
  translator: string | null;
  publisher: string | null;
  isbn: string | null;
  format: "PHYSICAL" | "ELECTRONIC";
  pageCount: number | null;
  publishedYear: number | null;
  editionLabel: string | null;
  externalLinks: AdminExternalLink[];
  editions: AdminBookEditionRow[];
}

export interface AdminBookEditionRow {
  id: string;
  catalogBookId: string;
  titleOverride: string | null;
  translator: string | null;
  publisher: string | null;
  isbn10: string | null;
  isbn13: string | null;
  format: "PHYSICAL" | "ELECTRONIC";
  pageCount: number | null;
  publishedYear: number | null;
  editionLabel: string | null;
  editionDescription: string | null;
  language: string | null;
  coverImage: string | null;
  coverFilename: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceEditionCode: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function cleanNullable(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeIsbn(value: string | null | undefined) {
  const cleaned = cleanNullable(value);
  return cleaned ? cleaned.replace(/[\s-]+/g, "") : null;
}

function assertMeaningfulEdition(input: {
  titleOverride?: string | null;
  translator?: string | null;
  publisher?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  coverImage?: string | null;
  editionDescription?: string | null;
  publishedYear?: number | null;
  pageCount?: number | null;
}) {
  const hasMeaningfulField = [
    input.titleOverride,
    input.translator,
    input.publisher,
    input.isbn10,
    input.isbn13,
    input.coverImage,
    input.editionDescription,
    input.publishedYear,
    input.pageCount,
  ].some((item) => item != null && String(item).trim() !== "");

  if (!hasMeaningfulField) {
    throw new Error("EDITION_NOT_DISTINGUISHED");
  }
}

async function ensureEditionIsbnUnique(
  input: { isbn10?: string | null; isbn13?: string | null },
  excludeEditionId?: string,
) {
  const isbn10 = normalizeIsbn(input.isbn10);
  const isbn13 = normalizeIsbn(input.isbn13);

  if (isbn10) {
    const [row] = await db
      .select({ id: BookEdition.id })
      .from(BookEdition)
      .where(
        excludeEditionId
          ? and(eq(BookEdition.isbn10, isbn10), sql`${BookEdition.id} <> ${excludeEditionId}`)
          : eq(BookEdition.isbn10, isbn10),
      )
      .limit(1);
    if (row) throw new Error("DUPLICATE_ISBN10");
  }

  if (isbn13) {
    const [row] = await db
      .select({ id: BookEdition.id })
      .from(BookEdition)
      .where(
        excludeEditionId
          ? and(eq(BookEdition.isbn13, isbn13), sql`${BookEdition.id} <> ${excludeEditionId}`)
          : eq(BookEdition.isbn13, isbn13),
      )
      .limit(1);
    if (row) throw new Error("DUPLICATE_ISBN13");
  }
}

export async function listAdminBookEditions(
  catalogBookId: string,
): Promise<AdminBookEditionRow[]> {
  return db
    .select({
      id: BookEdition.id,
      catalogBookId: BookEdition.catalogBookId,
      titleOverride: BookEdition.titleOverride,
      translator: BookEdition.translator,
      publisher: BookEdition.publisher,
      isbn10: BookEdition.isbn10,
      isbn13: BookEdition.isbn13,
      format: BookEdition.format,
      pageCount: BookEdition.pageCount,
      publishedYear: BookEdition.publishedYear,
      editionLabel: BookEdition.editionLabel,
      editionDescription: BookEdition.editionDescription,
      language: BookEdition.language,
      coverImage: BookEdition.coverImage,
      coverFilename: BookEdition.coverFilename,
      sourceName: BookEdition.sourceName,
      sourceUrl: BookEdition.sourceUrl,
      sourceEditionCode: BookEdition.sourceEditionCode,
      status: BookEdition.status,
      isPrimary: sql<boolean>`${CatalogBook.primaryEditionId} = ${BookEdition.id}`,
      createdAt: BookEdition.createdAt,
      updatedAt: BookEdition.updatedAt,
    })
    .from(BookEdition)
    .innerJoin(CatalogBook, eq(CatalogBook.id, BookEdition.catalogBookId))
    .where(eq(BookEdition.catalogBookId, catalogBookId))
    .orderBy(asc(BookEdition.createdAt), asc(BookEdition.id));
}

/** شناسه‌ی بهترین نسخه‌ی یک کتاب کانونی (همان معیار نماینده)، یا null. */
async function findRepresentativeEditionId(
  catalogBookId: string,
): Promise<string | null> {
  const [book] = await db
    .select({ primaryEditionId: CatalogBook.primaryEditionId })
    .from(CatalogBook)
    .where(eq(CatalogBook.id, catalogBookId))
    .limit(1);

  const editions = await db
    .select({
      id: BookEdition.id,
      status: BookEdition.status,
      coverImage: BookEdition.coverImage,
      publisher: BookEdition.publisher,
      translator: BookEdition.translator,
      isbn: BookEdition.isbn,
      isbn10: BookEdition.isbn10,
      isbn13: BookEdition.isbn13,
      createdAt: BookEdition.createdAt,
    })
    .from(BookEdition)
    .where(eq(BookEdition.catalogBookId, catalogBookId))
    .orderBy(asc(BookEdition.createdAt), asc(BookEdition.id));

  return resolveDisplayEdition(book?.primaryEditionId, editions)?.id ?? null;
}

/** داده‌ی کاملِ یک کتاب کاتالوگ برای فرم ویرایش ادمین. */
export async function getAdminCatalogBookForEdit(
  id: string,
): Promise<AdminBookEditData | null> {
  const [book] = await db
    .select({
      id: CatalogBook.id,
      slug: CatalogBook.slug,
      status: CatalogBook.status,
      title: CatalogBook.title,
      originalTitle: CatalogBook.originalTitle,
      author: CatalogBook.author,
      genre: CatalogBook.genre,
      description: CatalogBook.description,
      country: CatalogBook.country,
      language: CatalogBook.language,
      coverImage: CatalogBook.coverImage,
      primaryEditionId: CatalogBook.primaryEditionId,
    })
    .from(CatalogBook)
    .where(eq(CatalogBook.id, id))
    .limit(1);

  if (!book) return null;

  const [externalLinks, editions] = await Promise.all([
    listBookExternalLinks(id),
    listAdminBookEditions(id),
  ]);
  const editionId = await findRepresentativeEditionId(id);
  const edition = editionId
    ? (
        await db
          .select({
            id: BookEdition.id,
            translator: BookEdition.translator,
            publisher: BookEdition.publisher,
            isbn: BookEdition.isbn,
            format: BookEdition.format,
            pageCount: BookEdition.pageCount,
            publishedYear: BookEdition.publishedYear,
            editionLabel: BookEdition.editionLabel,
            coverImage: BookEdition.coverImage,
          })
          .from(BookEdition)
          .where(eq(BookEdition.id, editionId))
          .limit(1)
      )[0]
    : undefined;

  return {
    id: book.id,
    slug: book.slug,
    status: book.status,
    title: book.title,
    originalTitle: book.originalTitle,
    author: book.author,
    genres: splitStoredGenres(book.genre),
    description: book.description,
    country: book.country,
    language: book.language,
    coverImage: coalesceCoverImage(book.coverImage, edition?.coverImage),
    primaryEditionId: book.primaryEditionId,
    editionId: edition?.id ?? null,
    translator: edition?.translator ?? null,
    publisher: edition?.publisher ?? null,
    isbn: edition?.isbn ?? null,
    format: (edition?.format as "PHYSICAL" | "ELECTRONIC") ?? "ELECTRONIC",
    pageCount: edition?.pageCount ?? null,
    publishedYear: edition?.publishedYear ?? null,
    editionLabel: edition?.editionLabel ?? null,
    externalLinks,
    editions,
  };
}

/**
 * ویرایش ادمینیِ یک کتاب کاتالوگ:
 *  - فیلدهای کانونی روی CatalogBook به‌روزرسانی می‌شوند (به‌جز slug که فقط با
 *    درخواست صریحِ regenerateSlug عوض می‌شود تا لینک عمومی پایدار بماند).
 *  - فیلدهای نسخه‌ای روی نسخه‌ی نماینده اعمال می‌شوند (در نبود نسخه، یکی ساخته می‌شود).
 *  - جلد به‌صورت هماهنگ روی کاتالوگ و نسخه ذخیره/حذف می‌شود تا همه‌جا یکدست بماند.
 *  - ردیف‌های کتابخانه‌ی کاربران دست‌نخورده می‌مانند.
 */
export async function updateAdminCatalogBook(
  id: string,
  input: AdminBookUpdateInput,
  externalLinks?: ExternalLinkInput[],
): Promise<{ id: string; slug: string | null }> {
  const [existing] = await db
    .select({ id: CatalogBook.id, slug: CatalogBook.slug })
    .from(CatalogBook)
    .where(eq(CatalogBook.id, id))
    .limit(1);
  if (!existing) throw new Error("CATALOG_BOOK_NOT_FOUND");

  const clean = (v: string | null | undefined) => {
    if (v === undefined) return undefined;
    const t = (v ?? "").trim();
    return t ? t : null;
  };

  const coverProvided = input.coverImage !== undefined;
  const coverValue = coverProvided ? coalesceCoverImage(input.coverImage) : undefined;

  let nextSlug = existing.slug;
  if (input.regenerateSlug) {
    nextSlug = await generateUniqueCatalogBookSlug(input.title, id, id);
  }

  await db.transaction(async (tx) => {
    const catalogSet: Partial<typeof CatalogBook.$inferInsert> = {
      title: input.title.trim(),
      author: input.author.trim(),
      genre: input.genre.trim(),
      originalTitle: clean(input.originalTitle),
      description: clean(input.description),
      country: clean(input.country),
      language: clean(input.language),
      updatedAt: new Date(),
    };
    if (input.status) catalogSet.status = input.status;
    if (input.regenerateSlug && nextSlug) {
      catalogSet.slug = nextSlug;
      catalogSet.slugNormalized = slugify(nextSlug);
    }
    if (coverProvided) catalogSet.coverImage = coverValue ?? null;

    await tx.update(CatalogBook).set(catalogSet).where(eq(CatalogBook.id, id));

    const editionSet: Partial<typeof BookEdition.$inferInsert> = {
      translator: clean(input.translator),
      publisher: clean(input.publisher),
      isbn: clean(input.isbn),
      editionLabel: clean(input.editionLabel),
      pageCount: input.pageCount ?? null,
      publishedYear: input.publishedYear ?? null,
      language: clean(input.language),
      updatedAt: new Date(),
    };
    if (input.format) editionSet.format = input.format;
    if (coverProvided) editionSet.coverImage = coverValue ?? null;

    const editionId = await findRepresentativeEditionId(id);
    if (editionId) {
      await tx
        .update(BookEdition)
        .set(editionSet)
        .where(eq(BookEdition.id, editionId));
    } else {
      const newEditionId = crypto.randomUUID();
      await tx.insert(BookEdition).values({
        id: newEditionId,
        catalogBookId: id,
        format: input.format ?? "ELECTRONIC",
        status: "APPROVED",
        ...editionSet,
      });
      await tx
        .update(CatalogBook)
        .set({ primaryEditionId: newEditionId, updatedAt: new Date() })
        .where(and(eq(CatalogBook.id, id), sql`${CatalogBook.primaryEditionId} is null`));
    }

    // لینک‌های بیرونی فقط در صورت ارسالِ صریح جایگزین می‌شوند (replace-all).
    if (externalLinks !== undefined) {
      await upsertBookExternalLinks(id, externalLinks, tx);
    }
  });

  // ارتقای مقادیر مرجع به APPROVED (best-effort).
  try {
    const genres = splitStoredGenres(input.genre);
    await Promise.all([
      adminCreateReference("AUTHOR", input.author),
      ...genres.map((g) => adminCreateReference("GENRE", g)),
      input.translator
        ? adminCreateReference("TRANSLATOR", input.translator)
        : Promise.resolve(),
      input.publisher
        ? adminCreateReference("PUBLISHER", input.publisher)
        : Promise.resolve(),
      input.country
        ? adminCreateReference("COUNTRY", input.country)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("admin reference promote (update) failed:", err);
  }

  return { id, slug: nextSlug };
}

export async function createAdminBookEdition(
  catalogBookId: string,
  input: AdminEditionCreateInput,
  adminId: string,
): Promise<{ id: string }> {
  const [book] = await db
    .select({ id: CatalogBook.id })
    .from(CatalogBook)
    .where(eq(CatalogBook.id, catalogBookId))
    .limit(1);

  if (!book) throw new Error("CATALOG_BOOK_NOT_FOUND");

  await ensureEditionIsbnUnique(input);
  assertMeaningfulEdition(input);

  const [created] = await db
    .insert(BookEdition)
    .values({
      id: crypto.randomUUID(),
      catalogBookId,
      titleOverride: cleanNullable(input.titleOverride) ?? null,
      translator: cleanNullable(input.translator) ?? null,
      publisher: cleanNullable(input.publisher) ?? null,
      isbn10: normalizeIsbn(input.isbn10),
      isbn13: normalizeIsbn(input.isbn13),
      format: input.format ?? "PHYSICAL",
      coverImage: input.coverImage ?? null,
      publishedYear: input.publishedYear ?? null,
      editionLabel: cleanNullable(input.editionLabel) ?? null,
      editionDescription: cleanNullable(input.editionDescription) ?? null,
      pageCount: input.pageCount ?? null,
      language: cleanNullable(input.language) ?? null,
      sourceName: cleanNullable(input.sourceName) ?? null,
      sourceUrl: cleanNullable(input.sourceUrl) ?? null,
      sourceEditionCode: cleanNullable(input.sourceEditionCode) ?? null,
      status: input.status ?? "PENDING",
      createdById: adminId,
      updatedAt: new Date(),
    })
    .returning({ id: BookEdition.id });

  try {
    await Promise.all([
      input.translator
        ? adminCreateReference("TRANSLATOR", input.translator)
        : Promise.resolve(),
      input.publisher
        ? adminCreateReference("PUBLISHER", input.publisher)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("admin reference promote (edition create) failed:", err);
  }

  await db
    .update(CatalogBook)
    .set({ primaryEditionId: created.id, updatedAt: new Date() })
    .where(and(eq(CatalogBook.id, catalogBookId), sql`${CatalogBook.primaryEditionId} is null`));

  return created;
}

export async function updateAdminBookEdition(
  editionId: string,
  input: AdminEditionUpdateInput,
): Promise<{ id: string; catalogBookId: string }> {
  const [existing] = await db
    .select({ id: BookEdition.id, catalogBookId: BookEdition.catalogBookId })
    .from(BookEdition)
    .where(eq(BookEdition.id, editionId))
    .limit(1);

  if (!existing) throw new Error("EDITION_NOT_FOUND");

  await ensureEditionIsbnUnique(input, editionId);
  assertMeaningfulEdition(input);

  const [updated] = await db
    .update(BookEdition)
    .set({
      titleOverride: cleanNullable(input.titleOverride) ?? null,
      translator: cleanNullable(input.translator) ?? null,
      publisher: cleanNullable(input.publisher) ?? null,
      isbn10: normalizeIsbn(input.isbn10),
      isbn13: normalizeIsbn(input.isbn13),
      format: input.format ?? "PHYSICAL",
      coverImage: input.coverImage ?? null,
      publishedYear: input.publishedYear ?? null,
      editionLabel: cleanNullable(input.editionLabel) ?? null,
      editionDescription: cleanNullable(input.editionDescription) ?? null,
      pageCount: input.pageCount ?? null,
      language: cleanNullable(input.language) ?? null,
      sourceName: cleanNullable(input.sourceName) ?? null,
      sourceUrl: cleanNullable(input.sourceUrl) ?? null,
      sourceEditionCode: cleanNullable(input.sourceEditionCode) ?? null,
      status: input.status ?? "PENDING",
      updatedAt: new Date(),
    })
    .where(eq(BookEdition.id, editionId))
    .returning({ id: BookEdition.id, catalogBookId: BookEdition.catalogBookId });

  try {
    await Promise.all([
      input.translator
        ? adminCreateReference("TRANSLATOR", input.translator)
        : Promise.resolve(),
      input.publisher
        ? adminCreateReference("PUBLISHER", input.publisher)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("admin reference promote (edition update) failed:", err);
  }

  return updated;
}

export async function deleteAdminBookEdition(
  editionId: string,
): Promise<{ catalogBookId: string }> {
  const [deleted] = await db
    .delete(BookEdition)
    .where(eq(BookEdition.id, editionId))
    .returning({ catalogBookId: BookEdition.catalogBookId });

  if (!deleted) throw new Error("EDITION_NOT_FOUND");
  return deleted;
}

export async function setAdminCatalogBookPrimaryEdition(
  bookId: string,
  input: AdminPrimaryEditionInput,
  actorId?: string,
): Promise<{
  previousPrimaryEditionId: string | null;
  primaryEditionId: string | null;
  editionIdsBefore: string[];
  editionIdsAfter: string[];
}> {
  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: CatalogBook.id, primaryEditionId: CatalogBook.primaryEditionId })
      .from(CatalogBook)
      .where(eq(CatalogBook.id, bookId))
      .limit(1);

    if (!book) {
      console.warn("Rejected primary edition selection: catalog book not found", {
        catalogBookId: bookId,
        selectedEditionId: input.editionId,
        selectedEditionCatalogBookId: null,
        previousPrimaryEditionId: null,
        actorId,
      });
      throw new Error("CATALOG_BOOK_NOT_FOUND");
    }

    const editionsBefore = await tx
      .select({ id: BookEdition.id, catalogBookId: BookEdition.catalogBookId })
      .from(BookEdition)
      .where(eq(BookEdition.catalogBookId, bookId))
      .orderBy(asc(BookEdition.id));

    if (input.editionId !== null) {
      const [selectedEdition] = await tx
        .select({ id: BookEdition.id, catalogBookId: BookEdition.catalogBookId })
        .from(BookEdition)
        .where(eq(BookEdition.id, input.editionId))
        .limit(1);

      if (!selectedEdition) {
        console.warn("Rejected primary edition selection: edition not found", {
          catalogBookId: bookId,
          selectedEditionId: input.editionId,
          selectedEditionCatalogBookId: null,
          previousPrimaryEditionId: book.primaryEditionId,
          actorId,
        });
        throw new Error("EDITION_NOT_FOUND");
      }
      if (selectedEdition.catalogBookId !== bookId) {
        console.warn("Rejected cross-book primary edition selection", {
          catalogBookId: bookId,
          selectedEditionId: input.editionId,
          selectedEditionCatalogBookId: selectedEdition.catalogBookId,
          previousPrimaryEditionId: book.primaryEditionId,
          actorId,
        });
        throw new Error("EDITION_BOOK_MISMATCH");
      }
    }

    await tx
      .update(CatalogBook)
      // This action intentionally has exactly one business-field mutation.
      .set({ primaryEditionId: input.editionId })
      .where(eq(CatalogBook.id, bookId));

    const editionsAfter = await tx
      .select({ id: BookEdition.id, catalogBookId: BookEdition.catalogBookId })
      .from(BookEdition)
      .where(eq(BookEdition.catalogBookId, bookId))
      .orderBy(asc(BookEdition.id));

    const invariant = compareEditionSets(editionsBefore, editionsAfter);
    if (!invariant.ok) {
      console.error("CRITICAL: primary edition update mutated BookEdition rows", {
        catalogBookId: bookId,
        selectedEditionId: input.editionId,
        previousPrimaryEditionId: book.primaryEditionId,
        ...invariant,
      });
      throw new Error("PRIMARY_EDITION_MUTATED_EDITIONS");
    }

    return {
      previousPrimaryEditionId: book.primaryEditionId,
      primaryEditionId: input.editionId,
      editionIdsBefore: invariant.beforeIds,
      editionIdsAfter: invariant.afterIds,
    };
  });
}

export async function getAdminBookEditionsDebug(catalogBookId: string) {
  const [[catalogBook], editions] = await Promise.all([
    db
      .select({
        id: CatalogBook.id,
        primaryEditionId: CatalogBook.primaryEditionId,
      })
      .from(CatalogBook)
      .where(eq(CatalogBook.id, catalogBookId))
      .limit(1),
    listAdminBookEditions(catalogBookId),
  ]);

  if (!catalogBook) return null;

  const ids = editions.map((edition) => edition.id);
  const duplicateIds = findDuplicateEditionIds(editions);

  return {
    catalogBookId,
    primaryEditionId: catalogBook.primaryEditionId,
    editions: editions.map((edition) => ({
      id: edition.id,
      catalogBookId: edition.catalogBookId,
      titleOverride: edition.titleOverride,
      translator: edition.translator,
      publisher: edition.publisher,
      isbn: edition.isbn13 ?? edition.isbn10,
      isbn10: edition.isbn10,
      isbn13: edition.isbn13,
      sourceEditionCode: edition.sourceEditionCode,
      coverFilename: edition.coverFilename,
      coverImage: edition.coverImage,
      isPrimary: edition.id === catalogBook.primaryEditionId,
    })),
    diagnostics: {
      count: editions.length,
      duplicateIds,
      ids,
      primaryExistsInEditions:
        catalogBook.primaryEditionId === null
          ? false
          : ids.includes(catalogBook.primaryEditionId),
    },
  };
}

export interface AdminBookCoverResolution {
  catalogBook: {
    id: string;
    title: string;
    primaryEditionId: string | null;
    coverImage: string | null;
  };
  editions: Array<{
    id: string;
    titleOverride: string | null;
    publisher: string | null;
    translator: string | null;
    coverFilename: string | null;
    coverImage: string | null;
    isPrimary: boolean;
  }>;
  resolved: {
    displayEditionId: string | null;
    displayCoverImage: string | null;
    source:
      | "selectedEdition"
      | "primaryEdition"
      | "fallbackEdition"
      | "catalogBook"
      | "legacyBook"
      | "none";
  };
}

export async function getAdminBookCoverResolution(
  catalogBookId: string,
): Promise<AdminBookCoverResolution | null> {
  const [book, editions] = await Promise.all([
    db
      .select({
        id: CatalogBook.id,
        title: CatalogBook.title,
        primaryEditionId: CatalogBook.primaryEditionId,
        coverImage: CatalogBook.coverImage,
      })
      .from(CatalogBook)
      .where(eq(CatalogBook.id, catalogBookId))
      .limit(1),
    listAdminBookEditions(catalogBookId),
  ]);

  const catalogBook = book[0];
  if (!catalogBook) return null;

  const normalizedEditions = editions.map((edition) => ({
    ...edition,
    coverImage: coalesceCoverImage(edition.coverImage),
  }));

  const display = resolveBookDisplayData({
    title: catalogBook.title,
    author: "",
    editions: normalizedEditions,
    primaryEditionId: catalogBook.primaryEditionId,
    catalogBookCover: catalogBook.coverImage,
  });

  const source = display.displayEdition?.coverImage
    ? display.displayEditionId === catalogBook.primaryEditionId
      ? "primaryEdition"
      : "selectedEdition"
    : display.primaryEdition?.coverImage
      ? "primaryEdition"
      : display.fallbackEdition?.coverImage
        ? "fallbackEdition"
        : coalesceCoverImage(catalogBook.coverImage)
          ? "catalogBook"
          : "none";

  return {
    catalogBook: {
      id: catalogBook.id,
      title: catalogBook.title,
      primaryEditionId: catalogBook.primaryEditionId,
      coverImage: coalesceCoverImage(catalogBook.coverImage),
    },
    editions: normalizedEditions.map((edition) => ({
      id: edition.id,
      titleOverride: edition.titleOverride,
      publisher: edition.publisher,
      translator: edition.translator,
      coverFilename: edition.coverFilename,
      coverImage: edition.coverImage,
      isPrimary: edition.isPrimary,
    })),
    resolved: {
      displayEditionId: display.displayEditionId,
      displayCoverImage: display.displayCoverImage,
      source,
    },
  };
}
