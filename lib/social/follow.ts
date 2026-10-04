import { and, count, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { Follow, User } from "@/db/schema";

export async function getFollowState(profileUserId: string, viewerId?: string) {
  const [followers, following, relation] = await Promise.all([
    db.select({ value: count() }).from(Follow).where(eq(Follow.followingId, profileUserId)),
    db.select({ value: count() }).from(Follow).where(eq(Follow.followerId, profileUserId)),
    viewerId && viewerId !== profileUserId
      ? db.select({ followerId: Follow.followerId }).from(Follow).where(and(eq(Follow.followerId, viewerId), eq(Follow.followingId, profileUserId))).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    followerCount: followers[0]?.value ?? 0,
    followingCount: following[0]?.value ?? 0,
    isFollowing: relation.length > 0,
  };
}

export async function getFollowingUserIds(viewerId: string, userIds: string[]) {
  if (!userIds.length) return [];
  const rows = await db.select({ userId: Follow.followingId }).from(Follow)
    .where(and(eq(Follow.followerId, viewerId), inArray(Follow.followingId, userIds)));
  return rows.map((row) => row.userId);
}

export async function followUser(followerId: string, username: string) {
  const [target] = await db.select({ id: User.id }).from(User)
    .where(and(sql`lower(${User.username}) = lower(${username})`, eq(User.profileVisibility, "PUBLIC"))).limit(1);
  if (!target) return "NOT_FOUND" as const;
  if (target.id === followerId) return "SELF" as const;
  await db.insert(Follow).values({ followerId, followingId: target.id }).onConflictDoNothing();
  return "OK" as const;
}

export async function unfollowUser(followerId: string, username: string) {
  const [target] = await db.select({ id: User.id }).from(User)
    .where(sql`lower(${User.username}) = lower(${username})`).limit(1);
  if (!target) return "NOT_FOUND" as const;
  if (target.id === followerId) return "SELF" as const;
  await db.delete(Follow).where(and(eq(Follow.followerId, followerId), eq(Follow.followingId, target.id)));
  return "OK" as const;
}

export async function listFollows(profileUserId: string, kind: "followers" | "following", page = 1, includePrivate = false, query = "") {
  const search = query.trim();
  const rows = await db.select({
    userId: User.id,
    username: User.username,
    name: User.name,
    image: User.image,
  }).from(Follow)
    .innerJoin(User, eq(kind === "followers" ? Follow.followerId : Follow.followingId, User.id))
    .where(and(
      eq(kind === "followers" ? Follow.followingId : Follow.followerId, profileUserId),
      includePrivate ? undefined : eq(User.profileVisibility, "PUBLIC"),
      search ? or(ilike(User.username, `%${search}%`), ilike(User.name, `%${search}%`)) : undefined,
    ))
    .orderBy(sql`${Follow.createdAt} DESC`)
    .limit(31)
    .offset((page - 1) * 30);
  return {
    users: rows.slice(0, 30).filter((row): row is typeof row & { username: string } => !!row.username),
    hasMore: rows.length > 30,
  };
}
