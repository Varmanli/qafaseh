import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { Book, User } from "@/db/schema";
import { getReadingStats } from "@/lib/profile/service";

// Temporary, gated diagnostics for the route-split rollout. Enable with
// DEBUG_LIBRARY_ROUTE=1; remove once the username lookup is verified.
const DEBUG = process.env.DEBUG_LIBRARY_ROUTE === "1";
function debug(...args: unknown[]) {
  if (DEBUG) console.debug("[library/service]", ...args);
}

export interface LibraryBook {
  id: string;
  format: "PHYSICAL" | "ELECTRONIC";
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
  status: "UNREAD" | "READING" | "PAUSED" | "STOPPED" | "FINISHED";
  rating: number | null;
  translator: string | null;
  publisher: string | null;
  genre: string;
  createdAt: Date;
  isFavorite: boolean;
  pageCount: number | null;
  currentPage: number;
  progress: number | null;
  readingUpdatedAt: Date | null;
}

export interface LibraryProfile {
  id: string;
  username: string;
  displayName: string | null;
  image: string | null;
  bannerImage: string | null;
  bio: string | null;
  profileVisibility: "PUBLIC" | "PRIVATE";
}

export interface LibraryStats {
  total: number;
  reading: number;
  finished: number;
  unread: number;
  favorites: number;
}

export type LibraryByUsernameResult =
  | { found: false }
  | {
      found: true;
      isPrivate: true;
      isOwner: false;
      profile: Pick<
        LibraryProfile,
        "username" | "displayName" | "image" | "profileVisibility"
      >;
    }
  | {
      found: true;
      isPrivate: false;
      isOwner: boolean;
      profile: LibraryProfile;
      stats: LibraryStats;
      books: LibraryBook[];
    };

export async function getLibraryByUsername(
  username: string,
  viewerId?: string
): Promise<LibraryByUsernameResult> {
  const [user] = await db
    .select({
      id: User.id,
      username: User.username,
      displayName: User.name,
      image: User.image,
      bannerImage: User.profileBannerImage,
      bio: User.bio,
      profileVisibility: User.profileVisibility,
    })
    .from(User)
    .where(sql`lower(${User.username}) = lower(${username})`)
    .limit(1);

  debug("lookup username:", JSON.stringify(username), "→", user ?? "NO ROW");

  if (!user?.username) {
    debug("no user row for username → found: false");
    return { found: false };
  }

  const isOwner = !!viewerId && viewerId === user.id;
  debug(
    "resolved user:",
    { id: user.id, username: user.username, visibility: user.profileVisibility },
    "isOwner:",
    isOwner
  );

  if (user.profileVisibility === "PRIVATE" && !isOwner) {
    return {
      found: true,
      isPrivate: true,
      isOwner: false,
      profile: {
        username: user.username,
        displayName: user.displayName,
        image: user.image,
        profileVisibility: user.profileVisibility,
      },
    };
  }

  const rawBooks = await db
    .select({
      id: Book.id,
      format: Book.format,
      slug: Book.slug,
      title: Book.title,
      author: Book.author,
      coverImage: Book.coverImage,
      status: Book.status,
      rating: Book.rating,
      translator: Book.translator,
      publisher: Book.publisher,
      genre: Book.genre,
      createdAt: Book.createdAt,
      isFavorite: Book.isFavorite,
      pageCount: Book.pageCount,
      currentPage: Book.currentPage,
      progress: Book.progress,
      readingUpdatedAt: Book.readingUpdatedAt,
    })
    .from(Book)
    .where(eq(Book.userId, user.id))
    .orderBy(desc(Book.createdAt));

  const readingStats = await getReadingStats(user.id);
  const unread = Math.max(
    readingStats.total - readingStats.reading - readingStats.finished,
    0
  );

  return {
    found: true,
    isPrivate: false,
    isOwner,
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      image: user.image,
      bannerImage: user.bannerImage,
      bio: user.bio,
      profileVisibility: user.profileVisibility,
    },
    stats: {
      total: readingStats.total,
      reading: readingStats.reading,
      finished: readingStats.finished,
      unread,
      favorites: readingStats.favorites,
    },
    books: rawBooks.map((book) => ({
      ...book,
      isFavorite: book.isFavorite,
    })),
  };
}
