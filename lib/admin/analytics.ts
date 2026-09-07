import { sql } from "drizzle-orm";

import { db } from "@/db";

export const ANALYTICS_PERIODS = [1, 7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export function parseAnalyticsPeriod(value: string | undefined): AnalyticsPeriod {
  const parsed = Number(value);
  return ANALYTICS_PERIODS.includes(parsed as AnalyticsPeriod)
    ? (parsed as AnalyticsPeriod)
    : 30;
}

type RawResult<T> = { rows: T[] };
async function query<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as RawResult<T>).rows;
}

function periodBounds(days: AnalyticsPeriod) {
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - days);
  return { previousStart, start, end };
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function fillTrend(days: AnalyticsPeriod, start: Date, rows: { day: string; pageViews: number; visitors: number }[]) {
  const found = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const day = date.toISOString().slice(0, 10);
    const row = found.get(day);
    return {
      day,
      label: date.toLocaleDateString("fa-IR", { month: "short", day: "numeric" }),
      pageViews: row?.pageViews ?? 0,
      visitors: row?.visitors ?? 0,
    };
  });
}

export async function getAdminAnalytics(period: AnalyticsPeriod) {
  const { start, end, previousStart } = periodBounds(period);
  const [summaryRows, trendRows, bookRows, authorRows, pageRows, engagementRows, totalsRows, todayRows, recentSessions] = await Promise.all([
    query<{ pageViews: number; visitors: number; signedInVisitors: number; guestVisitors: number; newVisitors: number }>(sql`
      SELECT count(*)::int AS "pageViews",
        count(DISTINCT "visitor_id")::int AS "visitors",
        count(DISTINCT "visitor_id") FILTER (WHERE "user_id" IS NOT NULL)::int AS "signedInVisitors",
        count(DISTINCT "visitor_id") FILTER (WHERE "user_id" IS NULL)::int AS "guestVisitors",
        count(DISTINCT "visitor_id") FILTER (WHERE "first_seen" >= ${start})::int AS "newVisitors"
      FROM (
        SELECT p.*, min(p."created_at") OVER (PARTITION BY p."visitor_id") AS "first_seen"
        FROM "AnalyticsPageView" p
      ) p
      WHERE p."created_at" >= ${start} AND p."created_at" < ${end}
    `),
    query<{ day: string; pageViews: number; visitors: number }>(sql`
      SELECT to_char(date_trunc('day', "created_at"), 'YYYY-MM-DD') AS "day",
        count(*)::int AS "pageViews", count(DISTINCT "visitor_id")::int AS "visitors"
      FROM "AnalyticsPageView"
      WHERE "created_at" >= ${start} AND "created_at" < ${end}
      GROUP BY 1 ORDER BY 1
    `),
    query<{ label: string; views: number }>(sql`
      SELECT COALESCE(c."title", b."title", p."content_slug") AS "label", count(*)::int AS "views"
      FROM "AnalyticsPageView" p
      LEFT JOIN "CatalogBook" c ON (c."id" = p."content_slug" OR c."slug" = p."content_slug")
      LEFT JOIN "Book" b ON (b."id" = p."content_slug" OR b."slug" = p."content_slug")
      WHERE p."content_kind" = 'book' AND p."created_at" >= ${start} AND p."created_at" < ${end}
      GROUP BY 1 ORDER BY "views" DESC, "label" ASC LIMIT 6
    `),
    query<{ label: string; views: number }>(sql`
      SELECT COALESCE(r."name", p."content_slug") AS "label", count(*)::int AS "views"
      FROM "AnalyticsPageView" p
      LEFT JOIN "ReferenceItem" r ON r."type" = 'AUTHOR' AND r."slug" = p."content_slug"
      WHERE p."content_kind" = 'author' AND p."created_at" >= ${start} AND p."created_at" < ${end}
      GROUP BY 1 ORDER BY "views" DESC, "label" ASC LIMIT 6
    `),
    query<{ path: string; views: number }>(sql`
      SELECT "path", count(*)::int AS "views" FROM "AnalyticsPageView"
      WHERE "created_at" >= ${start} AND "created_at" < ${end}
      GROUP BY "path" ORDER BY "views" DESC, "path" ASC LIMIT 8
    `),
    query<{ libraryAdds: number; startedReading: number; finishedReading: number; quotes: number; publicNotes: number; privateNotes: number; activeUsers: number; newUsers: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM "Book" WHERE "created_at" >= ${start} AND "created_at" < ${end}) AS "libraryAdds",
        (SELECT count(*)::int FROM "ReadingEvent" WHERE "type" = 'START' AND "created_at" >= ${start} AND "created_at" < ${end}) AS "startedReading",
        (SELECT count(*)::int FROM "ReadingEvent" WHERE "type" = 'FINISH' AND "created_at" >= ${start} AND "created_at" < ${end}) AS "finishedReading",
        (SELECT count(*)::int FROM "Quote" WHERE "created_at" >= ${start} AND "created_at" < ${end}) AS "quotes",
        (SELECT count(*)::int FROM "PublishedBookNote" WHERE "created_at" >= ${start} AND "created_at" < ${end}) AS "publicNotes",
        (SELECT count(*)::int FROM "PersonalBookNote" WHERE "created_at" >= ${start} AND "created_at" < ${end}) AS "privateNotes",
        (SELECT count(*)::int FROM "User" WHERE "created_at" >= ${start} AND "created_at" < ${end}) AS "newUsers",
        (SELECT count(DISTINCT "user_id")::int FROM (
          SELECT "user_id" FROM "Book" WHERE "created_at" >= ${start} AND "created_at" < ${end}
          UNION SELECT "user_id" FROM "ReadingEvent" WHERE "created_at" >= ${start} AND "created_at" < ${end}
          UNION SELECT "user_id" FROM "Quote" WHERE "created_at" >= ${start} AND "created_at" < ${end}
          UNION SELECT "user_id" FROM "PublishedBookNote" WHERE "created_at" >= ${start} AND "created_at" < ${end}
          UNION SELECT "user_id" FROM "PersonalBookNote" WHERE "created_at" >= ${start} AND "created_at" < ${end}
        ) activity) AS "activeUsers"
    `),
    query<{ users: number; catalogBooks: number; editions: number; pendingBooks: number; pendingEditions: number; pendingReferences: number; quotes: number; notes: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM "User") AS "users",
        (SELECT count(*)::int FROM "CatalogBook") AS "catalogBooks",
        (SELECT count(*)::int FROM "BookEdition") AS "editions",
        (SELECT count(*)::int FROM "CatalogBook" WHERE "status" = 'PENDING') AS "pendingBooks",
        (SELECT count(*)::int FROM "BookEdition" WHERE "status" = 'PENDING') AS "pendingEditions",
        (SELECT count(*)::int FROM "ReferenceItem" WHERE "status" = 'PENDING') AS "pendingReferences",
        (SELECT count(*)::int FROM "Quote") AS "quotes",
        (SELECT count(*)::int FROM "PublishedBookNote") AS "notes"
    `),
    query<{ pageViews: number; visitors: number }>(sql`
      SELECT count(*)::int AS "pageViews", count(DISTINCT "visitor_id")::int AS "visitors"
      FROM "AnalyticsPageView" WHERE "created_at" >= date_trunc('day', now())
    `),
    query<{ visitorId: string; userName: string; username: string | null; path: string; ipAddress: string | null; userAgent: string | null; referrer: string | null; createdAt: Date }>(sql`
      SELECT p."visitor_id" AS "visitorId", COALESCE(u."name", 'مهمان') AS "userName", u."username", p."path",
        p."ip_address" AS "ipAddress", p."user_agent" AS "userAgent",
        p."referrer", p."created_at" AS "createdAt"
      FROM "AnalyticsPageView" p LEFT JOIN "User" u ON u."id" = p."user_id"
      ORDER BY p."created_at" DESC LIMIT 30
    `),
  ]);

  const summary = summaryRows[0] ?? { pageViews: 0, visitors: 0, signedInVisitors: 0, guestVisitors: 0, newVisitors: 0 };
  const [previous] = await query<{ pageViews: number; visitors: number }>(sql`
    SELECT count(*)::int AS "pageViews", count(DISTINCT "visitor_id")::int AS "visitors"
    FROM "AnalyticsPageView" WHERE "created_at" >= ${previousStart} AND "created_at" < ${start}
  `);
  const [yesterday] = await query<{ visitors: number }>(sql`
    SELECT count(DISTINCT "visitor_id")::int AS "visitors"
    FROM "AnalyticsPageView"
    WHERE "created_at" >= date_trunc('day', now()) - interval '1 day'
      AND "created_at" < date_trunc('day', now())
  `);

  return {
    period,
    range: { start: start.toISOString(), end: end.toISOString() },
    summary: {
      ...summary,
      pageViewsChange: percentageChange(summary.pageViews, previous?.pageViews ?? 0),
      visitorsChange: percentageChange(summary.visitors, previous?.visitors ?? 0),
    },
    today: todayRows[0] ?? { pageViews: 0, visitors: 0 },
    yesterday: yesterday?.visitors ?? 0,
    trend: fillTrend(period, start, trendRows),
    popularBooks: bookRows,
    popularAuthors: authorRows,
    popularPages: pageRows,
    engagement: engagementRows[0] ?? { libraryAdds: 0, startedReading: 0, finishedReading: 0, quotes: 0, publicNotes: 0, privateNotes: 0, activeUsers: 0, newUsers: 0 },
    totals: totalsRows[0] ?? { users: 0, catalogBooks: 0, editions: 0, pendingBooks: 0, pendingEditions: 0, pendingReferences: 0, quotes: 0, notes: 0 },
    recentSessions,
  };
}

export type AdminAnalytics = Awaited<ReturnType<typeof getAdminAnalytics>>;
