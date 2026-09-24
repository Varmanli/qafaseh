import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  Book,
  CatalogBook,
  HomeFeaturedBook,
  HomeHeroSlide,
  HomeHeroSlideBook,
  User,
  ReferenceItem,
} from "@/db/schema";
import { preferredEditionFieldSql } from "@/lib/book/primary-edition";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import {
  homeBookColumns,
  homeBookJoins,
  normalizeResolvedHomeBook,
} from "@/lib/home/book-resolver";
import { searchAdminCatalogBooks } from "@/lib/admin/service";
import { publicPersonBookRoles } from "@/lib/reference/book-contributions";
import { coalesceCoverImage, normalizeCoverImage } from "@/lib/book/cover";
import type { BookPresentationEdition } from "@/lib/book/presentation";
import {
  getLatestPublishedBlogPosts,
  type PublicBlogPostPreview,
} from "@/lib/blog/service";
import {
  getLatestPublicQuotes,
  type PublicQuote,
} from "@/lib/quotes/service";

export interface HomeHeroSlideSeed {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  guestPrimaryLabel: string;
  guestPrimaryHref: string;
  guestSecondaryLabel?: string;
  guestSecondaryHref?: string;
  memberPrimaryLabel: string;
  memberPrimaryHref: string;
  memberSecondaryLabel?: string;
  memberSecondaryHref?: string;
  visualBooks: Array<{
    title: string;
    author: string;
    tintClassName: string;
  }>;
}

export interface HomeBookCard {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
  genre: string | null;
  status: string | null;
  displayEdition?: BookPresentationEdition | null;
}

export interface AdminFeaturedBook {
  id: string;
  catalogBookId: string | null;
  bookId: string | null;
  resolvedCatalogBookId: string | null;
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
  genre: string | null;
  primaryEditionId: string | null;
  displayEditionId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface FeaturedBookSearchResult {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
}

type FeaturedBaseRow = {
  id: string;
  catalogBookId: string | null;
  bookId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
};

type LegacyBookDisplay = {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  genre: string | null;
  coverImage: string | null;
  catalogBookId: string | null;
};

type CatalogFeaturedDisplay = {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  genre: string | null;
  primaryEditionId: string | null;
  displayEditionId: string | null;
  coverImage: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export interface HomeHeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  visualBooks: Array<{
    title: string;
    author: string;
    tintClassName: string;
  }>;
}

export type HomeQuotePreview = PublicQuote;

export interface HomeReadingListPreview {
  id: string;
  title: string;
  description: string;
  books: string[];
  mood: string;
}

export type HomeBlogPostPreview = PublicBlogPostPreview;

export const HOME_FALLBACK_SLIDES: HomeHeroSlideSeed[] = [
  {
    id: "library",
    eyebrow: "کتابخانه شخصی",
    title: "جایی برای تمام کتاب‌هایی که با تو می‌مانند",
    description:
      "قفسه را برای ثبت کتاب‌ها، دسته‌بندی ساده و برگشتن به مسیر خواندن روزانه بساز.",
    accent: "ساخت کتابخانه شخصی",
    guestPrimaryLabel: "شروع با ثبت‌نام",
    guestPrimaryHref: "/auth/signup",
    guestSecondaryLabel: "ورود",
    guestSecondaryHref: "/auth/login",
    memberPrimaryLabel: "کتابخانه من",
    memberPrimaryHref: "/books",
    memberSecondaryLabel: "افزودن کتاب",
    memberSecondaryHref: "/books/add",
    visualBooks: [
      {
        title: "کتاب‌های خوانده‌شده",
        author: "قفسه شخصی",
        tintClassName: "bg-[var(--paper)] text-[#3f3425]",
      },
      {
        title: "در حال خواندن",
        author: "مسیر مطالعه",
        tintClassName: "bg-primary/15 text-foreground",
      },
      {
        title: "برای بعد",
        author: "یادداشت روزانه",
        tintClassName: "bg-secondary text-foreground",
      },
    ],
  },
  {
    id: "discover",
    eyebrow: "کشف کتاب",
    title: "از قفسه‌های عمومی الهام بگیر و کتاب بعدی‌ات را پیدا کن",
    description:
      "کتاب‌های تازه، تکه‌های محبوب و مسیرهای مطالعاتی دیگران را در یک صفحه ببین.",
    accent: "کشف کتاب‌های تازه",
    guestPrimaryLabel: "دیدن کتاب‌ها",
    guestPrimaryHref: "/auth/signup",
    guestSecondaryLabel: "ورود",
    guestSecondaryHref: "/auth/login",
    memberPrimaryLabel: "رفتن به داشبورد",
    memberPrimaryHref: "/dashboard",
    memberSecondaryLabel: "پروفایل من",
    memberSecondaryHref: "/settings/profile",
    visualBooks: [
      {
        title: "کشف هفتگی",
        author: "از میان قفسه‌ها",
        tintClassName: "bg-secondary text-foreground",
      },
      {
        title: "یادداشت‌ها و نقل‌قول‌ها",
        author: "خواندن جمعی",
        tintClassName: "bg-[var(--paper)] text-[#3f3425]",
      },
      {
        title: "نقشه مطالعه",
        author: "مسیرهای پیشنهادی",
        tintClassName: "bg-primary/15 text-foreground",
      },
    ],
  },
  {
    id: "quotes",
    eyebrow: "تکه‌های ماندگار",
    title: "جمله‌هایی را نگه دار که دوباره باید به آن‌ها برگردی",
    description:
      "تکه‌های کتاب، یادداشت‌های عمومی و برداشت‌های کوتاه را کنار کتاب‌هایت ثبت کن.",
    accent: "تکه‌های ماندگار از کتاب‌ها",
    guestPrimaryLabel: "عضویت در قفسه",
    guestPrimaryHref: "/auth/signup",
    guestSecondaryLabel: "ورود",
    guestSecondaryHref: "/auth/login",
    memberPrimaryLabel: "افزودن کتاب",
    memberPrimaryHref: "/books/add",
    memberSecondaryLabel: "کتابخانه من",
    memberSecondaryHref: "/books",
    visualBooks: [
      {
        title: "تکه‌های تازه",
        author: "نقل‌قول‌های امروز",
        tintClassName: "bg-primary/15 text-foreground",
      },
      {
        title: "یادداشت عمومی",
        author: "برداشت خواننده",
        tintClassName: "bg-secondary text-foreground",
      },
      {
        title: "بازگشت به کتاب",
        author: "صفحه‌های مهم",
        tintClassName: "bg-[var(--paper)] text-[#3f3425]",
      },
    ],
  },
  {
    id: "lists",
    eyebrow: "لیست‌های خواندنی",
    title: "برای حال‌وهوای هر دوره، یک مسیر خواندن آماده کن",
    description:
      "لیست‌های جمع‌وجور و کاربردی برای شروع، ادامه یا تغییر حال‌وهوای مطالعه.",
    accent: "لیست‌های خواندنی کاربران",
    guestPrimaryLabel: "ساخت حساب",
    guestPrimaryHref: "/auth/signup",
    guestSecondaryLabel: "ورود",
    guestSecondaryHref: "/auth/login",
    memberPrimaryLabel: "پروفایل من",
    memberPrimaryHref: "/settings/profile",
    memberSecondaryLabel: "کتابخانه من",
    memberSecondaryHref: "/books",
    visualBooks: [
      {
        title: "شروع ادبیات روسیه",
        author: "یک مسیر آرام",
        tintClassName: "bg-[var(--paper)] text-[#3f3425]",
      },
      {
        title: "برای روزهای سنگین",
        author: "خواندن کوتاه",
        tintClassName: "bg-secondary text-foreground",
      },
      {
        title: "کلاسیک‌های شروع",
        author: "پیشنهاد جمعی",
        tintClassName: "bg-primary/15 text-foreground",
      },
    ],
  },
];

export const HOME_PLACEHOLDER_LISTS: HomeReadingListPreview[] = [
  {
    id: "russian",
    title: "شروع ادبیات روسیه",
    description: "سه کتاب برای ورود آرام و قابل‌فهم به جهان نویسندگان روس.",
    books: ["ابله", "مرگ ایوان ایلیچ", "شب‌های روشن"],
    mood: "شروع مسیر",
  },
  {
    id: "heavy-days",
    title: "کتاب‌هایی برای روزهای سنگین",
    description: "کتاب‌هایی کوتاه‌تر و همدلانه برای وقتی که تمرکز کم است.",
    books: ["انسان در جست‌وجوی معنا", "پیرمرد و دریا", "سووشون"],
    mood: "حال‌وهوای شخصی",
  },
  {
    id: "classics",
    title: "کلاسیک‌هایی که ارزش شروع دارند",
    description: "فهرستی ساده برای شروع کلاسیک‌خوانی بدون سردرگمی.",
    books: ["بیگانه", "کوری", "صد سال تنهایی"],
    mood: "کلاسیک‌خوانی",
  },
];

async function listFeaturedBaseRows(): Promise<FeaturedBaseRow[]> {
  return db
    .select({
      id: HomeFeaturedBook.id,
      catalogBookId: HomeFeaturedBook.catalogBookId,
      bookId: HomeFeaturedBook.bookId,
      isActive: HomeFeaturedBook.isActive,
      sortOrder: HomeFeaturedBook.sortOrder,
      createdAt: HomeFeaturedBook.createdAt,
    })
    .from(HomeFeaturedBook)
    .orderBy(asc(HomeFeaturedBook.sortOrder), asc(HomeFeaturedBook.createdAt));
}

async function loadLegacyBookMap(bookIds: string[]) {
  if (bookIds.length === 0) return new Map<string, LegacyBookDisplay>();

  const rows = await db
    .select({
      id: Book.id,
      slug: Book.slug,
      title: Book.title,
      author: Book.author,
      genre: Book.genre,
      coverImage: Book.coverImage,
      catalogBookId: Book.catalogBookId,
    })
    .from(Book)
    .where(inArray(Book.id, bookIds));

  return new Map(rows.map((row) => [row.id, row]));
}

async function loadCatalogDisplayMap(catalogIds: string[]) {
  if (catalogIds.length === 0) return new Map<string, CatalogFeaturedDisplay>();

  const rows = await db
    .select({
      id: CatalogBook.id,
      slug: CatalogBook.slug,
      title: CatalogBook.title,
      author: CatalogBook.author,
      genre: CatalogBook.genre,
      status: CatalogBook.status,
      primaryEditionId: CatalogBook.primaryEditionId,
      displayEditionId: preferredEditionFieldSql<string | null>("id"),
      coverImage: displayCoverFieldSql(),
    })
    .from(CatalogBook)
    .where(inArray(CatalogBook.id, catalogIds));

  return new Map(rows.map((row) => [row.id, row]));
}

async function resolveFeaturedRows(rows: FeaturedBaseRow[]) {
  const bookIds = rows
    .map((row) => row.bookId)
    .filter((value): value is string => Boolean(value));
  const legacyMap = await loadLegacyBookMap(bookIds);

  const catalogIds = new Set<string>();
  for (const row of rows) {
    if (row.catalogBookId) {
      catalogIds.add(row.catalogBookId);
      continue;
    }
    const legacy = row.bookId ? legacyMap.get(row.bookId) : null;
    if (legacy?.catalogBookId) {
      catalogIds.add(legacy.catalogBookId);
    }
  }

  const catalogMap = await loadCatalogDisplayMap([...catalogIds]);

  return rows.map((row) => {
    if (row.catalogBookId) {
      const catalog = catalogMap.get(row.catalogBookId) ?? null;
      return {
        row,
        resolvedCatalogBookId: row.catalogBookId,
        sourceType: "catalog" as const,
        catalog,
        legacy: null,
      };
    }

    const legacy = row.bookId ? legacyMap.get(row.bookId) ?? null : null;
    if (legacy?.catalogBookId) {
      return {
        row,
        resolvedCatalogBookId: legacy.catalogBookId,
        sourceType: "catalog" as const,
        catalog: catalogMap.get(legacy.catalogBookId) ?? null,
        legacy,
      };
    }

    return {
      row,
      resolvedCatalogBookId: null,
      sourceType: "legacy" as const,
      catalog: null,
      legacy,
    };
  });
}

/**
 * Popular books for the homepage.
 *
 * NOTE: there is no view-count / popularity metric yet. As a safe fallback we
 * return the most recently added books from public profiles, de-duplicated by
 * canonical identity (`catalogBookId`, else lowercased title) so the same book
 * from different users isn't repeated. When a real popularity signal exists,
 * only the query ordering here should change.
 */
export async function getPopularBooks(limit = 12): Promise<HomeBookCard[]> {
  const rows = await db
    .select({
      id: Book.id,
      slug: Book.slug,
      title: Book.title,
      author: Book.author,
      coverImage: Book.coverImage,
      genre: Book.genre,
      status: Book.status,
      catalogBookId: Book.catalogBookId,
    })
    .from(Book)
    .innerJoin(User, eq(Book.userId, User.id))
    .where(eq(User.profileVisibility, "PUBLIC"))
    .orderBy(desc(Book.createdAt))
    .limit(limit * 5);

  const catalogIds = rows
    .map((row) => row.catalogBookId)
    .filter((value): value is string => Boolean(value));
  const catalogMap = await loadCatalogDisplayMap([...new Set(catalogIds)]);
  const seen = new Set<string>();
  const out: HomeBookCard[] = [];

  for (const row of rows) {
    const key = row.catalogBookId ?? row.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const catalog = row.catalogBookId ? catalogMap.get(row.catalogBookId) : null;
    out.push({
      id: catalog?.id ?? row.id,
      slug: catalog?.slug ?? row.slug,
      title: catalog?.title ?? row.title,
      author: catalog?.author ?? row.author,
      coverImage: coalesceCoverImage(catalog?.coverImage, row.coverImage),
      genre: catalog?.genre ?? row.genre,
      status: row.status,
    });
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * کتاب‌های پیشنهادیِ انتخاب‌شده توسط ادمین (فقط فعال‌ها، به ترتیب دلخواه ادمین).
 * اگر ادمین چیزی انتخاب نکرده باشد، آرایه‌ی خالی برمی‌گردد و صفحه‌ی اصلی به
 * کتاب‌های اخیرِ عمومی به‌عنوان fallback برمی‌گردد.
 */
export async function getFeaturedBooks(limit = 12): Promise<HomeBookCard[]> {
  const rows = (await listFeaturedBaseRows()).filter((row) => row.isActive);
  const resolvedRows = await resolveFeaturedRows(rows);

  return resolvedRows
    .map((item): HomeBookCard | null => {
      if (item.sourceType === "catalog") {
        if (!item.catalog || item.catalog.status !== "APPROVED") return null;
        return {
          id: item.row.id,
          slug: item.catalog.slug,
          title: item.catalog.title,
          author: item.catalog.author,
          coverImage: coalesceCoverImage(item.catalog.coverImage),
          genre: item.catalog.genre,
          status: null,
        };
      }

      if (!item.legacy?.slug) return null;
      return {
        id: item.row.id,
        slug: item.legacy.slug,
        title: item.legacy.title,
        author: item.legacy.author,
        coverImage: coalesceCoverImage(item.legacy.coverImage),
        genre: item.legacy.genre,
        status: null,
      };
    })
    .filter((item): item is HomeBookCard => item !== null)
    .slice(0, limit);
}

// ---------------- مدیریت ادمین: کتاب‌های پیشنهادی ----------------
export async function adminListFeaturedBooks(): Promise<AdminFeaturedBook[]> {
  const rows = await listFeaturedBaseRows();
  const resolvedRows = await resolveFeaturedRows(rows);

  return resolvedRows.map((item) => {
    const fromCatalog = item.sourceType === "catalog" ? item.catalog : null;
    const fromLegacy = item.sourceType === "legacy" ? item.legacy : null;

    return {
      id: item.row.id,
      catalogBookId: item.row.catalogBookId,
      bookId: item.row.bookId,
      resolvedCatalogBookId: item.resolvedCatalogBookId,
      slug: fromCatalog?.slug ?? fromLegacy?.slug ?? null,
      title: fromCatalog?.title ?? fromLegacy?.title ?? "—",
      author: fromCatalog?.author ?? fromLegacy?.author ?? "",
      coverImage: coalesceCoverImage(fromCatalog?.coverImage ?? fromLegacy?.coverImage ?? null),
      genre: fromCatalog?.genre ?? fromLegacy?.genre ?? null,
      primaryEditionId: fromCatalog?.primaryEditionId ?? null,
      displayEditionId: fromCatalog?.displayEditionId ?? null,
      isActive: item.row.isActive,
      sortOrder: item.row.sortOrder,
    } satisfies AdminFeaturedBook;
  });
}

export async function adminAddFeaturedBook(catalogBookId: string): Promise<AdminFeaturedBook> {
  const [catalog] = await db
    .select({ id: CatalogBook.id })
    .from(CatalogBook)
    .where(eq(CatalogBook.id, catalogBookId))
    .limit(1);

  if (!catalog) {
    throw new Error("CATALOG_BOOK_NOT_FOUND");
  }

  const existingRows = await listFeaturedBaseRows();
  const resolvedRows = await resolveFeaturedRows(existingRows);
  const duplicate = resolvedRows.find(
    (item) => item.resolvedCatalogBookId === catalogBookId,
  );

  if (duplicate) {
    await db
      .update(HomeFeaturedBook)
      .set({
        catalogBookId,
        bookId: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(HomeFeaturedBook.id, duplicate.row.id));

    return (await adminListFeaturedBooks()).find((item) => item.id === duplicate.row.id)!;
  }

  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${HomeFeaturedBook.sortOrder}), -1)::int`,
    })
    .from(HomeFeaturedBook);
  const nextOrder = (row?.max ?? -1) + 1;
  const [created] = await db
    .insert(HomeFeaturedBook)
    .values({ catalogBookId, bookId: null, sortOrder: nextOrder })
    .returning({ id: HomeFeaturedBook.id });

  return (await adminListFeaturedBooks()).find((item) => item.id === created.id)!;
}

export async function adminSetFeaturedActive(
  id: string,
  isActive: boolean
): Promise<void> {
  if (!isActive) {
    await db
      .update(HomeFeaturedBook)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(HomeFeaturedBook.id, id));
    return;
  }

  const rows = await listFeaturedBaseRows();
  const resolvedRows = await resolveFeaturedRows(rows);
  const target = resolvedRows.find((item) => item.row.id === id);

  if (!target) return;

  await db.transaction(async (tx) => {
    if (target.resolvedCatalogBookId) {
      const duplicateIds = resolvedRows
        .filter(
          (item) =>
            item.row.id !== id &&
            item.resolvedCatalogBookId === target.resolvedCatalogBookId &&
            item.row.isActive,
        )
        .map((item) => item.row.id);

      if (duplicateIds.length > 0) {
        await tx
          .update(HomeFeaturedBook)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(HomeFeaturedBook.id, duplicateIds));
      }
    }

    await tx
      .update(HomeFeaturedBook)
      .set({
        isActive: true,
        catalogBookId: target.resolvedCatalogBookId ?? target.row.catalogBookId,
        bookId: target.resolvedCatalogBookId ? null : target.row.bookId,
        updatedAt: new Date(),
      })
      .where(eq(HomeFeaturedBook.id, id));
  });
}

export async function adminRemoveFeaturedBook(id: string): Promise<void> {
  await db.delete(HomeFeaturedBook).where(eq(HomeFeaturedBook.id, id));
}

/** ترتیب جدید را بر اساس آرایه‌ی idها اعمال می‌کند (index = sortOrder). */
export async function adminReorderFeaturedBooks(
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(HomeFeaturedBook)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(HomeFeaturedBook.id, id))
    )
  );
}

// ---------------- اسلایدر هیرو: نوع‌ها ----------------
export interface HeroSlideBook {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
}

/** شکل عمومیِ اسلاید برای رندر در صفحه‌ی اصلی. */
export interface HeroSlideView {
  id: string;
  badge: string | null;
  title: string;
  description: string | null;
  primaryLabel: string | null;
  primaryHref: string | null;
  secondaryLabel: string | null;
  secondaryHref: string | null;
  imageUrl: string | null;
  books: HeroSlideBook[];
}

/** شکل اسلاید برای مدیریت ادمین (شامل وضعیت و ترتیب). */
export interface AdminHeroSlide {
  id: string;
  title: string;
  description: string | null;
  badge: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  books: HeroSlideBook[];
}

export interface HeroSlideInput {
  title: string;
  description?: string | null;
  badge?: string | null;
  primaryCtaLabel?: string | null;
  primaryCtaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
}

/** حداکثر تعداد کتاب در هر اسلاید. */
export const HERO_SLIDE_MAX_BOOKS = 3;

/** کتاب‌های انتخابیِ مجموعه‌ای از اسلایدها را گروه‌بندی‌شده برمی‌گرداند. */
async function loadSlideBooks(
  slideIds: string[]
): Promise<Map<string, HeroSlideBook[]>> {
  const map = new Map<string, HeroSlideBook[]>();
  if (slideIds.length === 0) return map;

  const j = homeBookJoins("hero");
  const cols = homeBookColumns(j);
  const rows = await db
    .select({
      slideId: HomeHeroSlideBook.slideId,
      // شناسه‌ی هویت = catalogBookId جدید یا book_id قدیمی (برای ذخیره‌ی دوباره).
      identityId: sql<string | null>`coalesce(
        ${HomeHeroSlideBook.catalogBookId},
        ${cols.catalogBookId},
        ${HomeHeroSlideBook.bookId}
      )`,
      catalogBookId: cols.catalogBookId,
      slug: cols.slug,
      title: cols.title,
      author: cols.author,
      coverImage: cols.coverImage,
      genre: cols.genre,
    })
    .from(HomeHeroSlideBook)
    .leftJoin(
      j.directCatalog,
      eq(j.directCatalog.id, HomeHeroSlideBook.catalogBookId),
    )
    .leftJoin(j.linkedBook, eq(j.linkedBook.id, HomeHeroSlideBook.bookId))
    .leftJoin(j.linkedCatalog, eq(j.linkedCatalog.id, j.linkedBook.catalogBookId))
    .where(inArray(HomeHeroSlideBook.slideId, slideIds))
    .orderBy(asc(HomeHeroSlideBook.sortOrder));

  for (const row of rows) {
    const resolved = normalizeResolvedHomeBook(row);
    if (!resolved) continue;
    const list = map.get(row.slideId) ?? [];
    list.push({
      id: row.identityId ?? resolved.slug ?? row.slideId,
      slug: resolved.slug,
      title: resolved.title,
      author: resolved.author,
      coverImage: resolved.coverImage,
    });
    map.set(row.slideId, list);
  }
  return map;
}

/** اسلایدهای فعال صفحه‌ی اصلی (به ترتیب) همراه کتاب‌های انتخابی. */
export async function getHeroSlides(): Promise<HeroSlideView[]> {
  const slides = await db
    .select()
    .from(HomeHeroSlide)
    .where(eq(HomeHeroSlide.isActive, true))
    .orderBy(asc(HomeHeroSlide.sortOrder), asc(HomeHeroSlide.createdAt));

  if (slides.length === 0) return [];

  const books = await loadSlideBooks(slides.map((s) => s.id));
  return slides.map((s) => ({
    id: s.id,
    badge: s.badge,
    title: s.title,
    description: s.description,
    primaryLabel: s.primaryCtaLabel,
    primaryHref: s.primaryCtaHref,
    secondaryLabel: s.secondaryCtaLabel,
    secondaryHref: s.secondaryCtaHref,
    imageUrl: s.imageUrl,
    books: books.get(s.id) ?? [],
  }));
}

// ---------------- مدیریت ادمین: اسلایدر هیرو ----------------
export async function adminListHeroSlides(): Promise<AdminHeroSlide[]> {
  const slides = await db
    .select()
    .from(HomeHeroSlide)
    .orderBy(asc(HomeHeroSlide.sortOrder), asc(HomeHeroSlide.createdAt));

  const books = await loadSlideBooks(slides.map((s) => s.id));
  return slides.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    badge: s.badge,
    primaryCtaLabel: s.primaryCtaLabel,
    primaryCtaHref: s.primaryCtaHref,
    secondaryCtaLabel: s.secondaryCtaLabel,
    secondaryCtaHref: s.secondaryCtaHref,
    imageUrl: s.imageUrl,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    books: books.get(s.id) ?? [],
  }));
}

function normalizeSlideValues(input: HeroSlideInput) {
  const clean = (v: string | null | undefined) => {
    const t = (v ?? "").trim();
    return t ? t : null;
  };
  return {
    title: input.title.trim(),
    description: clean(input.description),
    badge: clean(input.badge),
    primaryCtaLabel: clean(input.primaryCtaLabel),
    primaryCtaHref: clean(input.primaryCtaHref),
    secondaryCtaLabel: clean(input.secondaryCtaLabel),
    secondaryCtaHref: clean(input.secondaryCtaHref),
    imageUrl: clean(input.imageUrl),
  };
}

export async function adminCreateHeroSlide(
  input: HeroSlideInput
): Promise<string> {
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${HomeHeroSlide.sortOrder}), -1)::int`,
    })
    .from(HomeHeroSlide);
  const nextOrder = (row?.max ?? -1) + 1;

  const [created] = await db
    .insert(HomeHeroSlide)
    .values({
      ...normalizeSlideValues(input),
      isActive: input.isActive ?? true,
      sortOrder: nextOrder,
    })
    .returning({ id: HomeHeroSlide.id });
  return created.id;
}

export async function adminUpdateHeroSlide(
  id: string,
  input: HeroSlideInput
): Promise<void> {
  await db
    .update(HomeHeroSlide)
    .set({
      ...normalizeSlideValues(input),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(HomeHeroSlide.id, id));
}

export async function adminSetHeroSlideActive(
  id: string,
  isActive: boolean
): Promise<void> {
  await db
    .update(HomeHeroSlide)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(HomeHeroSlide.id, id));
}

export async function adminDeleteHeroSlide(id: string): Promise<void> {
  await db.delete(HomeHeroSlide).where(eq(HomeHeroSlide.id, id));
}

export async function adminReorderHeroSlides(
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(HomeHeroSlide)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(HomeHeroSlide.id, id))
    )
  );
}

/**
 * کتاب‌های یک اسلاید را جایگزین می‌کند (حداکثر ۳، به ترتیب). شناسه‌های ورودی،
 * شناسه‌ی کانونیِ کاتالوگ‌اند؛ ولی برای سازگاری اگر شناسه‌ای به یک ردیف legacy
 * کتابخانه اشاره داشته باشد، در ستون book_id ذخیره می‌شود.
 */
export async function adminSetHeroSlideBooks(
  slideId: string,
  identityIds: string[]
): Promise<void> {
  const limited = identityIds.slice(0, HERO_SLIDE_MAX_BOOKS);
  await db
    .delete(HomeHeroSlideBook)
    .where(eq(HomeHeroSlideBook.slideId, slideId));
  if (limited.length === 0) return;

  const values = await Promise.all(
    limited.map(async (identityId, index) => {
      const ref = await resolveHomeBookRef(identityId);
      return { slideId, ...ref, sortOrder: index };
    }),
  );
  await db.insert(HomeHeroSlideBook).values(values);
}

/**
 * شناسه‌ی هویت (از انتخابگر) را به مرجع ستونیِ home content تبدیل می‌کند:
 * اگر CatalogBook باشد → catalog_book_id (مسیر جدید و کانونی)، اگر یک ردیف
 * legacy کتابخانه باشد → book_id (سازگاری). انتخابگرِ جدید همیشه catalogBookId
 * می‌دهد؛ این تابع فقط برای حفظ سازگاریِ آیتم‌های قدیمی هنگام ذخیره‌ی دوباره است.
 */
async function resolveHomeBookRef(
  identityId: string,
): Promise<{ catalogBookId: string | null; bookId: string | null }> {
  const [catalog] = await db
    .select({ id: CatalogBook.id })
    .from(CatalogBook)
    .where(eq(CatalogBook.id, identityId))
    .limit(1);
  if (catalog) return { catalogBookId: catalog.id, bookId: null };

  const [book] = await db
    .select({ id: Book.id })
    .from(Book)
    .where(eq(Book.id, identityId))
    .limit(1);
  if (book) return { catalogBookId: null, bookId: book.id };

  // پیش‌فرض: به‌عنوان شناسه‌ی کاتالوگ (در صورت نامعتبربودن، قید FK جلوگیری می‌کند).
  return { catalogBookId: identityId, bookId: null };
}

/**
 * جست‌وجوی کتاب برای انتخابگر صفحه‌ی اصلی. هویت = CatalogBook (کانونی)، پس
 * کتاب‌های ساخته‌شده توسط ادمین هم دیده می‌شوند. منطق در `searchAdminCatalogBooks`
 * متمرکز است تا تکرار نشود.
 */
export async function searchBooksForFeature(
  q: string,
  limit = 10
): Promise<FeaturedBookSearchResult[]> {
  const results = await searchAdminCatalogBooks(q, { limit });
  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    author: r.author,
    coverImage: r.coverImage,
  }));
}

/** نام رسمیِ موردنظرِ سرویس برای انتخابگرِ کتابِ صفحه‌ی اصلی. */
export const getHomepageBookSelectorOptions = searchBooksForFeature;

/**
 * Recent public quotes for the homepage.
 *
 * Quote rows have no timestamp yet, so we sort by id descending as the current
 * "newest first" proxy. Public reachability is delegated to
 * `getLatestPublicQuotes`, which mirrors the public book-page rules.
 */
export async function getRecentHomeQuotes(
  limit = 6,
  viewerId?: string,
): Promise<HomeQuotePreview[]> {
  return getLatestPublicQuotes(limit, viewerId);
}

export async function getLatestHomeBlogPosts(
  limit = 3,
): Promise<HomeBlogPostPreview[]> {
  return getLatestPublishedBlogPosts(limit);
}

export async function getPopularAuthors(limit = 10): Promise<Array<{
  id: string;
  name: string;
  slug: string | null;
  coverImage: string | null;
  bookCount: number;
  readCount: number;
}>> {
  const rows = (await db.execute(sql`
    WITH person_books AS (
      SELECT DISTINCT reference_item_id, catalog_book_id
      FROM (${publicPersonBookRoles}) contributions
    )
    SELECT r.id, r.name, r.slug, r.cover_image AS "coverImage",
      count(DISTINCT pb.catalog_book_id)::int AS "bookCount",
      count(DISTINCT b.id) FILTER (WHERE b.status = 'FINISHED')::int AS "readCount"
    FROM "ReferenceItem" r
    JOIN person_books pb ON pb.reference_item_id = r.id
    LEFT JOIN "Book" b ON b.catalog_book_id = pb.catalog_book_id
    WHERE r.type = 'AUTHOR' AND r.status = 'APPROVED'
    GROUP BY r.id
    ORDER BY "readCount" DESC, "bookCount" DESC, r.name ASC
    LIMIT ${limit}
  `) as unknown as { rows: Array<{ id: string; name: string; slug: string | null; coverImage: string | null; bookCount: number; readCount: number }> }).rows;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    coverImage: normalizeCoverImage(r.coverImage),
    bookCount: r.bookCount,
    readCount: r.readCount,
  }));
}

export interface HomeGenreDiscovery {
  id: string;
  name: string;
  slug: string;
  bookCount: number;
}

/** Stable, database-ranked public genres for the homepage. */
export async function getHomepageGenres(limit = 10): Promise<HomeGenreDiscovery[]> {
  const result = await db.execute<{
    id: string;
    name: string;
    slug: string;
    bookCount: number;
  }>(sql`
    select reference.id, reference.name, reference.slug,
      counts.book_count as "bookCount"
    from "ReferenceItem" reference
    join (
      select lower(trim(genre_value)) as genre, count(distinct book.id)::int as book_count
      from "CatalogBook" book
      cross join lateral regexp_split_to_table(
        coalesce(book.genre, ''), E'[\\n\\r،,;؛•]+'
      ) as genre_value
      where book.status = 'APPROVED'
      group by lower(trim(genre_value))
    ) counts on counts.genre = lower(reference.name)
    where reference.type = 'GENRE'
      and reference.status = 'APPROVED'
      and reference.slug is not null
    order by counts.book_count desc, reference.name asc
    limit ${limit}
  `);
  return result.rows;
}
