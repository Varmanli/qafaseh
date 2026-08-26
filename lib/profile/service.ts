import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { Book, User } from "@/db/schema";
import { isValidUsername, normalizeUsername } from "@/lib/profile/username-rules";
import type { UpdateProfileInput } from "@/lib/validations/profile";

/** خطای کنترل‌شده‌ی پروفایل که route handler آن را به پاسخ HTTP تبدیل می‌کند. */
export class ProfileError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
    this.name = "ProfileError";
  }
}

export interface MyProfile {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  image: string | null;
  bannerImage: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  telegram: string | null;
  profileVisibility: "PUBLIC" | "PRIVATE";
  createdAt: Date;
}

export interface ReadingStats {
  total: number;
  reading: number;
  finished: number;
  wantToRead: number;
  favorites: number;
  averageRating: number | null;
}

const profileColumns = {
  id: User.id,
  name: User.name,
  email: User.email,
  username: User.username,
  image: User.image,
  bannerImage: User.profileBannerImage,
  bio: User.bio,
  location: User.location,
  website: User.website,
  instagram: User.instagram,
  twitter: User.twitter,
  linkedin: User.linkedin,
  telegram: User.telegram,
  profileVisibility: User.profileVisibility,
  createdAt: User.createdAt,
};

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const [user] = await db
    .select(profileColumns)
    .from(User)
    .where(eq(User.id, userId));
  return (user as MyProfile) ?? null;
}

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const normalizedUsername = normalizeUsername(username);
  if (!isValidUsername(normalizedUsername)) {
    return false;
  }

  const [row] = await db
    .select({ id: User.id })
    .from(User)
    .where(sql`lower(${User.username}) = lower(${normalizedUsername})`);
  return !row || row.id === excludeUserId;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<MyProfile> {
  if (input.username !== undefined) {
    const normalizedUsername = normalizeUsername(input.username);
    if (!isValidUsername(normalizedUsername)) {
      throw new ProfileError("نام کاربری نامعتبر است", 422, "INVALID_USERNAME");
    }

    const available = await isUsernameAvailable(normalizedUsername, userId);
    if (!available) {
      throw new ProfileError(
        "این نام کاربری قبلاً انتخاب شده است",
        409,
        "USERNAME_TAKEN"
      );
    }
  }

  // فقط کلیدهای ارسال‌شده به‌روزرسانی می‌شوند (null برای پاک‌کردن مجاز است)
  const set: Partial<typeof User.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.username !== undefined) set.username = normalizeUsername(input.username);
  if (input.bio !== undefined) set.bio = input.bio;
  if (input.location !== undefined) set.location = input.location;
  if (input.website !== undefined) set.website = input.website;
  if (input.instagram !== undefined) set.instagram = input.instagram;
  if (input.twitter !== undefined) set.twitter = input.twitter;
  if (input.linkedin !== undefined) set.linkedin = input.linkedin;
  if (input.telegram !== undefined) set.telegram = input.telegram;
  if (input.image !== undefined) set.image = input.image;
  if (input.bannerImage !== undefined)
    set.profileBannerImage = input.bannerImage;
  try {
    await db.update(User).set(set).where(eq(User.id, userId));
  } catch (err) {
    // در صورت برخورد با محدودیت یکتایی نام‌کاربری (شرایط رقابتی)
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      throw new ProfileError(
        "این نام کاربری قبلاً انتخاب شده است",
        409,
        "USERNAME_TAKEN"
      );
    }
    throw err;
  }

  const profile = await getMyProfile(userId);
  if (!profile) throw new ProfileError("کاربر یافت نشد", 404);
  return profile;
}

/**
 * Changes only profile visibility (plus the normal audit timestamp).
 * Keeping this separate from the general profile update prevents stale form
 * data from overwriting profile fields and makes relation changes impossible.
 */
export async function updateProfileVisibility(
  userId: string,
  visibility: "PUBLIC" | "PRIVATE"
): Promise<MyProfile> {
  const [updated] = await db
    .update(User)
    .set({ profileVisibility: visibility, updatedAt: new Date() })
    .where(eq(User.id, userId))
    .returning({ id: User.id });

  if (!updated) throw new ProfileError("کاربر یافت نشد", 404);

  const profile = await getMyProfile(userId);
  if (!profile) throw new ProfileError("کاربر یافت نشد", 404);
  return profile;
}

export async function getReadingStats(userId: string): Promise<ReadingStats> {
  const rows = await db
    .select({
      status: Book.status,
      count: sql<number>`count(*)::int`,
    })
    .from(Book)
    .where(eq(Book.userId, userId))
    .groupBy(Book.status);

  let total = 0;
  let reading = 0;
  let finished = 0;
  let wantToRead = 0;
  for (const r of rows) {
    total += r.count;
    if (r.status === "READING") reading = r.count;
    if (r.status === "FINISHED") finished = r.count;
    if (r.status === "UNREAD") wantToRead = r.count;
  }

  const [fav] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(Book)
    .where(and(eq(Book.userId, userId), eq(Book.isFavorite, true)));

  const [ratingRow] = await db
    .select({ average: sql<string | null>`round(avg(${Book.rating}) filter (where ${Book.rating} is not null and ${Book.rating} > 0), 1)` })
    .from(Book)
    .where(eq(Book.userId, userId));

  return { total, reading, finished, wantToRead, favorites: fav?.count ?? 0, averageRating: ratingRow?.average != null ? Number(ratingRow.average) : null };
}

export interface PublicBookPreview {
  id: string;
  title: string;
  author: string;
  coverImage: string | null;
  status: string;
}

export type PublicProfileResult =
  | { found: false }
  | {
      found: true;
      isPrivate: true;
      isOwner: false;
      username: string | null;
      displayName: string | null;
      image: string | null;
    }
  | {
      found: true;
      isPrivate: false;
      isOwner: boolean;
      profile: {
        username: string | null;
        displayName: string | null;
        image: string | null;
        bannerImage: string | null;
        bio: string | null;
        location: string | null;
        website: string | null;
        instagram: string | null;
        twitter: string | null;
        linkedin: string | null;
        telegram: string | null;
        profileVisibility: "PUBLIC" | "PRIVATE";
        joinedAt: Date;
      };
      stats: ReadingStats;
      books: PublicBookPreview[];
    };

export async function getPublicProfile(
  username: string,
  viewerId?: string
): Promise<PublicProfileResult> {
  const [user] = await db
    .select(profileColumns)
    .from(User)
    .where(sql`lower(${User.username}) = lower(${username})`);

  if (!user) return { found: false };

  const isOwner = !!viewerId && viewerId === user.id;

  if (user.profileVisibility === "PRIVATE" && !isOwner) {
    return {
      found: true,
      isPrivate: true,
      isOwner: false,
      username: user.username,
      displayName: user.name,
      image: user.image,
    };
  }

  const stats = await getReadingStats(user.id);

  const books = await db
    .select({
      id: Book.id,
      title: Book.title,
      author: Book.author,
      coverImage: Book.coverImage,
      status: Book.status,
    })
    .from(Book)
    .where(eq(Book.userId, user.id))
    .orderBy(desc(Book.createdAt))
    .limit(60);

  return {
    found: true,
    isPrivate: false,
    isOwner,
    profile: {
      username: user.username,
      displayName: user.name,
      image: user.image,
      bannerImage: user.bannerImage,
      bio: user.bio,
      location: user.location,
      website: user.website,
      instagram: user.instagram,
      twitter: user.twitter,
      linkedin: user.linkedin,
      telegram: user.telegram,
      profileVisibility: user.profileVisibility,
      joinedAt: user.createdAt,
    },
    stats,
    books,
  };
}
