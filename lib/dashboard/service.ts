import { and, desc, eq, sql, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  Book,
  CatalogBook,
  PublishedBookNote,
  Quote,
  ReferenceItem,
  User,
  Wishlist,
} from "@/db/schema";
import { getReadingStats } from "@/lib/profile/service";
import { normalizeCoverImage } from "@/lib/book/cover";

export interface DashboardBookPreview {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
  status: "UNREAD" | "READING" | "PAUSED" | "STOPPED" | "FINISHED";
  rating: number | null;
  createdAt: Date;
}

export interface DashboardPendingSubmission {
  id: string;
  title: string;
  type: "CATALOG_BOOK" | "REFERENCE";
  createdAt: Date;
}

export interface DashboardQuotePreview {
  id: string;
  content: string;
  imageKey: string | null;
  background: string;
  page: number | null;
  bookId: string;
  bookSlug: string | null;
  bookTitle: string;
}

export interface DashboardNotePreview {
  id: string;
  content: string;
  bookId: string;
  bookSlug: string | null;
  bookTitle: string;
  createdAt: Date;
}

export interface UserDashboardData {
  profile: {
    id: string;
    name: string | null;
    username: string;
    image: string | null;
    bannerImage: string | null;
    bio: string | null;
    profileVisibility: "PUBLIC" | "PRIVATE";
  };
  stats: {
    totalBooks: number;
    reading: number;
    finished: number;
    unread: number;
    favorites: number;
    wishlist: number;
    quotes: number;
    notes: number;
  };
  currentlyReading: DashboardBookPreview[];
  recentlyAdded: DashboardBookPreview[];
  recentQuotes: DashboardQuotePreview[];
  recentNotes: DashboardNotePreview[];
  pendingSubmissions: DashboardPendingSubmission[];
  profileCompletion: {
    completed: number;
    total: number;
    percent: number;
    missing: string[];
  };
}

export async function getUserDashboardData(
  userId: string
): Promise<UserDashboardData | null> {
  const [user] = await db
    .select({
      id: User.id,
      name: User.name,
      username: User.username,
      image: User.image,
      bannerImage: User.profileBannerImage,
      bio: User.bio,
      profileVisibility: User.profileVisibility,
    })
    .from(User)
    .where(eq(User.id, userId))
    .limit(1);

  if (!user?.username) {
    return null;
  }

  const [
    readingStats,
    wishlistCount,
    quotesCount,
    notesCount,
    currentlyReading,
    recentlyAdded,
    recentQuotes,
    recentNotes,
    pendingCatalogBooks,
    pendingReferences,
  ] = await Promise.all([
      getReadingStats(userId),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(Wishlist)
        .where(eq(Wishlist.userId, userId))
        .then((rows) => rows[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(Quote)
        .where(eq(Quote.userId, userId))
        .then((rows) => rows[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(PublishedBookNote)
        .where(eq(PublishedBookNote.userId, userId))
        .then((rows) => rows[0]?.count ?? 0),
      db
        .select({
          id: Book.id,
          slug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
          title: Book.title,
          author: Book.author,
          coverImage: Book.coverImage,
          status: Book.status,
          rating: Book.rating,
          createdAt: Book.createdAt,
        })
        .from(Book)
        .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
        .where(and(eq(Book.userId, userId), eq(Book.status, "READING")))
        .orderBy(desc(Book.createdAt))
        .limit(6),
      db
        .select({
          id: Book.id,
          slug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
          title: Book.title,
          author: Book.author,
          coverImage: Book.coverImage,
          status: Book.status,
          rating: Book.rating,
          createdAt: Book.createdAt,
        })
        .from(Book)
        .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
        .where(eq(Book.userId, userId))
        .orderBy(desc(Book.createdAt))
        .limit(8),
      // جدیدترین تکه‌های خود کاربر.
      db
        .select({
          id: Quote.id,
          content: Quote.content,
          imageKey: Quote.imageKey,
          background: Quote.background,
          page: Quote.page,
          bookId: Quote.bookId,
          bookSlug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
          bookTitle: Book.title,
        })
        .from(Quote)
        .innerJoin(Book, eq(Quote.bookId, Book.id))
        .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
        .where(eq(Quote.userId, userId))
        .orderBy(desc(Quote.createdAt))
        .limit(3),
      db
        .select({
          id: PublishedBookNote.id,
          bookId: sql<string>`coalesce(${PublishedBookNote.bookId}, ${Book.id}, '')`,
          bookSlug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
          bookTitle: sql<string>`coalesce(${CatalogBook.title}, ${Book.title}, 'کتاب')`,
          createdAt: PublishedBookNote.createdAt,
        })
        .from(PublishedBookNote)
        .leftJoin(Book, eq(PublishedBookNote.bookId, Book.id))
        .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
        .where(eq(PublishedBookNote.userId, userId))
        .orderBy(desc(PublishedBookNote.createdAt))
        .limit(3),
      db
        .select({
          id: CatalogBook.id,
          title: CatalogBook.title,
          createdAt: CatalogBook.createdAt,
        })
        .from(CatalogBook)
        .where(
          and(eq(CatalogBook.createdById, userId), eq(CatalogBook.status, "PENDING"))
        )
        .orderBy(desc(CatalogBook.createdAt))
        .limit(4),
      db
        .select({
          id: ReferenceItem.id,
          title: ReferenceItem.name,
          createdAt: ReferenceItem.createdAt,
        })
        .from(ReferenceItem)
        .where(
          and(
            eq(ReferenceItem.createdById, userId),
            eq(ReferenceItem.status, "PENDING")
          )
        )
        .orderBy(desc(ReferenceItem.createdAt))
        .limit(4),
    ]);

  const unread = Math.max(
    readingStats.total - readingStats.reading - readingStats.finished,
    0
  );

  const completionChecks = [
    { ok: !!user.username, label: "نام کاربری" },
    { ok: !!user.image, label: "تصویر پروفایل" },
    { ok: !!user.bio?.trim(), label: "بیوگرافی" },
    { ok: user.profileVisibility === "PUBLIC", label: "حالت عمومی پروفایل" },
  ];
  const completed = completionChecks.filter((item) => item.ok).length;
  const total = completionChecks.length;

  return {
    profile: {
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      bannerImage: user.bannerImage,
      bio: user.bio,
      profileVisibility: user.profileVisibility,
    },
    stats: {
      totalBooks: readingStats.total,
      reading: readingStats.reading,
      finished: readingStats.finished,
      unread,
      favorites: readingStats.favorites,
      wishlist: wishlistCount,
      quotes: quotesCount,
      notes: notesCount,
    },
    currentlyReading,
    recentlyAdded,
    recentQuotes,
    recentNotes: recentNotes.map((note) => ({
      ...note,
      // Dashboard only needs a preview/link.  Deliberately do not read the
      // potentially corrupted TOAST content column here.
      content: "متن یادداشت در این نمای خلاصه نمایش داده نمی‌شود.",
    })),
    pendingSubmissions: [
      ...pendingCatalogBooks.map((item) => ({
        ...item,
        type: "CATALOG_BOOK" as const,
      })),
      ...pendingReferences.map((item) => ({
        ...item,
        type: "REFERENCE" as const,
      })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    profileCompletion: {
      completed,
      total,
      percent: Math.round((completed / total) * 100),
      missing: completionChecks.filter((item) => !item.ok).map((item) => item.label),
    },
  };
}

export interface UserReadingInsights {
  overview: {
    finishedBooksCount: number;
    readingBooksCount: number;
    totalBooksCount: number;
    totalPagesCount: number;
    averagePagesCount: number;
    uniqueAuthorsCount: number;
    notesCount: number;
    quotesCount: number;
  };
  monthlyActivity: Array<{ label: string; count: number; pages: number }>;
  favoriteAuthors: Array<{ id: string; name: string; slug: string | null; coverImage: string | null; bookCount: number }>;
  favoriteCountries: Array<{ name: string; count: number }>;
  favoriteGenres: Array<{ name: string; count: number; percentage: number }>;
  favoritePublishers: Array<{ name: string; count: number; percentage: number }>;
  formatDistribution: { physical: number; electronic: number };
  lengthPreference: { short: number; medium: number; long: number };
  ratingStats: {
    averageRating: number;
    ratedCount: number;
    distribution: Array<{ rating: number; count: number }>;
  };
  consistency: {
    monthsWithActivity: number;
    mostActiveMonth: string | null;
    completedThisYear: number;
    completedLastYear: number;
  };
  profileInsights: string[];
  recentCompleted: Array<{
    id: string;
    title: string;
    author: string;
    coverImage: string | null;
    slug: string | null;
    rating: number | null;
    completedAt: Date | null;
  }>;
}

export async function getUserReadingInsights(
  userId: string
): Promise<UserReadingInsights> {
  const [
    books,
    [quotesCountRow],
    [notesCountRow],
  ] = await Promise.all([
    db
      .select({
        id: Book.id,
        title: Book.title,
        author: Book.author,
        country: Book.country,
        genre: Book.genre,
        pageCount: Book.pageCount,
        publisher: Book.publisher,
        status: Book.status,
        completedAt: Book.completedAt,
        rating: Book.rating,
        isFavorite: Book.isFavorite,
        format: Book.format,
        coverImage: Book.coverImage,
        slug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
        catalogBookId: Book.catalogBookId,
      })
      .from(Book)
      .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
      .where(eq(Book.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(Quote)
      .where(eq(Quote.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(PublishedBookNote)
      .where(eq(PublishedBookNote.userId, userId)),
  ]);

  const completedBooks = books.filter((b) => b.status === "FINISHED");
  const readingBooks = books.filter((b) => b.status === "READING");

  // Overview metrics
  const finishedBooksCount = completedBooks.length;
  const readingBooksCount = readingBooks.length;
  const totalBooksCount = books.length;
  const totalPagesCount = completedBooks.reduce((sum, b) => sum + (b.pageCount || 0), 0);

  const completedWithPages = completedBooks.filter((b) => b.pageCount && b.pageCount > 0);
  const averagePagesCount =
    completedWithPages.length > 0
      ? Math.round(completedWithPages.reduce((sum, b) => sum + (b.pageCount || 0), 0) / completedWithPages.length)
      : 0;

  const uniqueAuthorsCount = new Set(completedBooks.map((b) => b.author.trim().toLowerCase())).size;
  const notesCount = notesCountRow?.count ?? 0;
  const quotesCount = quotesCountRow?.count ?? 0;

  // Monthly activity (last 12 months)
  const now = new Date();
  const monthlyActivity: Array<{ label: string; count: number; pages: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = new Intl.DateTimeFormat("fa-IR", { month: "long", year: "2-digit" }).format(d);
    monthlyActivity.push({ label, count: 0, pages: 0 });
  }

  for (const book of completedBooks) {
    if (book.completedAt) {
      const label = new Intl.DateTimeFormat("fa-IR", { month: "long", year: "2-digit" }).format(book.completedAt);
      const bucket = monthlyActivity.find((m) => m.label === label);
      if (bucket) {
        bucket.count += 1;
        bucket.pages += book.pageCount || 0;
      }
    }
  }

  // Favorite Authors
  const authorCounts: Record<string, { name: string; count: number; totalRating: number; ratedCount: number }> = {};
  for (const book of completedBooks) {
    const name = book.author.trim();
    if (!authorCounts[name]) {
      authorCounts[name] = { name, count: 0, totalRating: 0, ratedCount: 0 };
    }
    authorCounts[name].count += 1;
    if (book.rating != null) {
      authorCounts[name].totalRating += book.rating || 0;
      authorCounts[name].ratedCount += 1;
    }
  }

  const sortedAuthors = Object.values(authorCounts)
    .sort((a, b) => b.count - a.count || (b.totalRating / (b.ratedCount || 1)) - (a.totalRating / (a.ratedCount || 1)))
    .slice(0, 4);

  const favoriteAuthors: Array<{ id: string; name: string; slug: string | null; coverImage: string | null; bookCount: number }> = [];
  if (sortedAuthors.length > 0) {
    const authorNames = sortedAuthors.map((a) => a.name);
    const dbAuthors = await db
      .select({
        id: ReferenceItem.id,
        name: ReferenceItem.name,
        slug: ReferenceItem.slug,
        coverImage: ReferenceItem.coverImage,
      })
      .from(ReferenceItem)
      .where(
        and(
          eq(ReferenceItem.type, "AUTHOR"),
          inArray(ReferenceItem.name, authorNames)
        )
      );

    for (const sa of sortedAuthors) {
      const dbAuthor = dbAuthors.find((a) => a.name.trim().toLowerCase() === sa.name.toLowerCase());
      favoriteAuthors.push({
        id: dbAuthor?.id ?? sa.name,
        name: sa.name,
        slug: dbAuthor?.slug ?? null,
        coverImage: dbAuthor?.coverImage ? normalizeCoverImage(dbAuthor.coverImage) : null,
        bookCount: sa.count,
      });
    }
  }

  // Favorite Literary Countries
  const countryCounts: Record<string, number> = {};
  for (const book of completedBooks) {
    if (book.country?.trim()) {
      const c = book.country.trim();
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    }
  }
  const favoriteCountries = Object.entries(countryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Favorite Genres
  const genreCounts: Record<string, number> = {};
  for (const book of completedBooks) {
    if (book.genre?.trim()) {
      const parts = book.genre.split(/[،,]+/).map((g) => g.trim()).filter(Boolean);
      const uniqueParts = [...new Set(parts)];
      for (const g of uniqueParts) {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }
  }
  const totalFinishedWithGenre = completedBooks.filter((b) => b.genre?.trim()).length;
  const favoriteGenres = Object.entries(genreCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalFinishedWithGenre > 0 ? Math.round((count / totalFinishedWithGenre) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  // Favorite Publishers
  const publisherCounts: Record<string, number> = {};
  for (const book of completedBooks) {
    if (book.publisher?.trim()) {
      const p = book.publisher.trim();
      publisherCounts[p] = (publisherCounts[p] || 0) + 1;
    }
  }
  const favoritePublishers = Object.entries(publisherCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: completedBooks.length > 0 ? Math.round((count / completedBooks.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Format distribution
  const formatDistribution = { physical: 0, electronic: 0 };
  for (const book of completedBooks) {
    if (book.format === "ELECTRONIC") {
      formatDistribution.electronic += 1;
    } else {
      formatDistribution.physical += 1;
    }
  }

  // Book length preference
  const lengthPreference = { short: 0, medium: 0, long: 0 };
  for (const book of completedBooks) {
    if (book.pageCount) {
      if (book.pageCount < 200) lengthPreference.short += 1;
      else if (book.pageCount <= 400) lengthPreference.medium += 1;
      else lengthPreference.long += 1;
    }
  }

  // Average rating & rating distribution (1 to 10)
  const ratingDistribution = Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: 0 }));
  let ratedCount = 0;
  let totalRating = 0;
  for (const book of completedBooks) {
    if (book.rating != null) {
      ratedCount += 1;
      totalRating += book.rating;
      const item = ratingDistribution.find((r) => r.rating === book.rating);
      if (item) item.count += 1;
    }
  }
  const averageRating = ratedCount > 0 ? Number((totalRating / ratedCount).toFixed(1)) : 0;

  // Consistency / Streak
  const monthsWithActivity = monthlyActivity.filter((m) => m.count > 0).length;
  let mostActiveMonth: string | null = null;
  let maxMonthlyCount = 0;
  for (const m of monthlyActivity) {
    if (m.count > maxMonthlyCount) {
      maxMonthlyCount = m.count;
      mostActiveMonth = m.label;
    }
  }

  const currentYear = new Date().getFullYear();
  const completedThisYear = completedBooks.filter((b) => b.completedAt && b.completedAt.getFullYear() === currentYear).length;
  const completedLastYear = completedBooks.filter((b) => b.completedAt && b.completedAt.getFullYear() === currentYear - 1).length;

  // Profile Insights
  const profileInsights: string[] = [];
  if (favoriteGenres.length > 0) {
    profileInsights.push(`علاقه‌مندی اصلی تو در ژانر ${favoriteGenres[0].name} است.`);
  }
  if (favoriteAuthors.length > 0) {
    profileInsights.push(`بیشترین کتاب‌های خوانده‌شده‌ی تو از نویسنده محبوب ${favoriteAuthors[0].name} است.`);
  }
  if (favoriteCountries.length > 0) {
    profileInsights.push(`بیشتر به مطالعه آثار ادبیات کشور ${favoriteCountries[0].name} تمایل داری.`);
  }
  if (completedBooks.length > 0) {
    const preferredFormat = formatDistribution.physical >= formatDistribution.electronic ? "فیزیکی" : "الکترونیک";
    profileInsights.push(`قالب ترجیحی تو برای خواندن کتاب‌ها، نسخه ${preferredFormat} است.`);
  }

  // Recent completed
  const recentCompleted = completedBooks
    .sort((a, b) => {
      const aTime = a.completedAt?.getTime() ?? 0;
      const bTime = b.completedAt?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 6)
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      coverImage: normalizeCoverImage(b.coverImage),
      slug: b.slug,
      rating: b.rating,
      completedAt: b.completedAt,
    }));

  return {
    overview: {
      finishedBooksCount,
      readingBooksCount,
      totalBooksCount,
      totalPagesCount,
      averagePagesCount,
      uniqueAuthorsCount,
      notesCount,
      quotesCount,
    },
    monthlyActivity,
    favoriteAuthors,
    favoriteCountries,
    favoriteGenres,
    favoritePublishers,
    formatDistribution,
    lengthPreference,
    ratingStats: {
      averageRating,
      ratedCount,
      distribution: ratingDistribution,
    },
    consistency: {
      monthsWithActivity,
      mostActiveMonth,
      completedThisYear,
      completedLastYear,
    },
    profileInsights,
    recentCompleted,
  };
}
