import { and, asc, eq, isNotNull, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { User } from "@/db/schema";
import { normalizeSearchText } from "@/lib/book/search-normalize";
import { RESERVED_USERNAMES } from "@/lib/profile/username-rules";

export interface PublicUserSearchResult {
  username: string;
  name: string | null;
  image: string | null;
}

export function normalizeUserSearchQuery(raw: string) {
  return raw.trim().replace(/^@/, "").trim().toLowerCase();
}

function userSearchWhere(rawQuery: string) {
  const usernameQuery = normalizeUserSearchQuery(rawQuery);
  const nameQuery = normalizeSearchText(usernameQuery);
  const normalizedName = sql`qafaseh_search_normalize(${User.name})`;
  return and(
    eq(User.profileVisibility, "PUBLIC"),
    isNotNull(User.username),
    sql`trim(${User.username}) <> ''`,
    notInArray(sql`lower(${User.username})`, [...RESERVED_USERNAMES]),
    or(
      sql`strpos(lower(${User.username}), ${usernameQuery}) > 0`,
      nameQuery ? sql`strpos(${normalizedName}, ${nameQuery}) > 0` : undefined,
    ),
  );
}

export function buildPublicUserSearchQuery(rawQuery: string, limit: number, offset = 0) {
  const usernameQuery = normalizeUserSearchQuery(rawQuery);
  const nameQuery = normalizeSearchText(usernameQuery);
  const normalizedName = sql`qafaseh_search_normalize(${User.name})`;
  return db.select({ username: User.username, name: User.name, image: User.image })
    .from(User)
    .where(userSearchWhere(rawQuery))
    .orderBy(sql`case
      when lower(${User.username}) = ${usernameQuery} then 0
      when ${normalizedName} = ${nameQuery} then 1
      when strpos(lower(${User.username}), ${usernameQuery}) = 1 then 2
      when strpos(${normalizedName}, ${nameQuery}) = 1 then 3
      when strpos(lower(${User.username}), ${usernameQuery}) > 0 then 4
      else 5 end`, asc(User.username))
    .limit(Math.max(1, Math.min(50, Math.trunc(limit))))
    .offset(Math.max(0, Math.trunc(offset)));
}

export async function searchPublicUsers(rawQuery: string, limit: number, offset = 0): Promise<PublicUserSearchResult[]> {
  if (!normalizeUserSearchQuery(rawQuery)) return [];
  const rows = await buildPublicUserSearchQuery(rawQuery, limit, offset);
  return rows.map((row) => ({ username: row.username!, name: row.name, image: row.image }));
}

export async function countPublicUsers(rawQuery: string): Promise<number> {
  if (!normalizeUserSearchQuery(rawQuery)) return 0;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(User).where(userSearchWhere(rawQuery));
  return row?.count ?? 0;
}
