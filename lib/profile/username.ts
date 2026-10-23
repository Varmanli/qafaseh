import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { User } from "@/db/schema";
import { isBookIdLikeIdentifier, isReservedUsername, isValidUsername, normalizeUsername, RESERVED_USERNAMES } from "@/lib/profile/username-rules";

const USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const USERNAME_PREFIX = "user-";
const USERNAME_SUFFIX_LENGTH = 6;
export {
  RESERVED_USERNAMES,
  isBookIdLikeIdentifier,
  isReservedUsername,
  isValidUsername,
  normalizeUsername,
};

function randomSuffix(length = USERNAME_SUFFIX_LENGTH) {
  let out = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * USERNAME_ALPHABET.length);
    out += USERNAME_ALPHABET[randomIndex];
  }
  return out;
}

export function buildRandomUsername() {
  return `${USERNAME_PREFIX}${randomSuffix()}`;
}

export async function generateUniqueUsername(reader: Pick<typeof db, "select"> = db) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = buildRandomUsername();
    const [existing] = await reader
      .select({ id: User.id })
      .from(User)
      .where(sql`lower(${User.username}) = lower(${candidate})`)
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique username");
}

export async function ensureUserHasUsername(userId: string) {
  const [existing] = await db
    .select({ username: User.username })
    .from(User)
    .where(eq(User.id, userId))
    .limit(1);

  if (existing?.username?.trim()) {
    return existing.username;
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const username = await generateUniqueUsername();

    try {
      const [updated] = await db
        .update(User)
        .set({ username, updatedAt: new Date() })
        .where(
          sql`${User.id} = ${userId} and (${User.username} is null or ${User.username} = '')`
        )
        .returning({ username: User.username });

      if (updated?.username) {
        return updated.username;
      }

      const [current] = await db
        .select({ username: User.username })
        .from(User)
        .where(eq(User.id, userId))
        .limit(1);

      if (current?.username?.trim()) {
        return current.username;
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Unable to assign a username to user ${userId}`);
}

export async function backfillMissingUsernames() {
  const users = await db
    .select({ id: User.id })
    .from(User)
    .where(or(sql`${User.username} is null`, eq(User.username, "")));

  let updatedCount = 0;

  for (const user of users) {
    await ensureUserHasUsername(user.id);
    updatedCount += 1;
  }

  return { updatedCount, scannedCount: users.length };
}
