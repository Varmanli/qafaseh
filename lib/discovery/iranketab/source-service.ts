import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  IranKetabDiscoveryMembership,
  IranKetabDiscoveryRun,
  IranKetabDiscoverySource,
  User,
} from "@/db/schema";
import type {
  IranKetabDiscoverySourceInput,
  UpdateIranKetabDiscoverySourceInput,
} from "@/lib/validations/iranketab-discovery";
import { canonicalIranKetabDiscoverySourceUrl, prepareIranKetabDiscoverySourceCreateValues } from "./source-policy";
import type { IranKetabPublisherSource } from "./publisher-source";

export { prepareIranKetabDiscoverySourceCreateValues } from "./source-policy";

export const IRANKETAB_DISCOVERY_SOURCE_PAGE_SIZE = 25;

export class IranKetabDiscoverySourceError extends Error {
  constructor(
    public readonly code:
      | "DISCOVERY_SOURCE_NOT_FOUND"
      | "DISCOVERY_SOURCE_ALREADY_EXISTS"
      | "DISCOVERY_SOURCE_NOT_EMPTY",
  ) {
    super(code);
  }
}

const sourceSelection = {
  id: IranKetabDiscoverySource.id,
  name: IranKetabDiscoverySource.name,
  sourceType: IranKetabDiscoverySource.sourceType,
  sourceUrl: IranKetabDiscoverySource.sourceUrl,
  sourceKey: IranKetabDiscoverySource.sourceKey,
  importance: IranKetabDiscoverySource.importance,
  enabled: IranKetabDiscoverySource.enabled,
  crawlStatus: IranKetabDiscoverySource.crawlStatus,
  crawlIntervalMinutes: IranKetabDiscoverySource.crawlIntervalMinutes,
  autoQueue: IranKetabDiscoverySource.autoQueue,
  importMode: IranKetabDiscoverySource.importMode,
  minimumQueueScore: IranKetabDiscoverySource.minimumQueueScore,
  parserVersion: IranKetabDiscoverySource.parserVersion,
  lastCrawledAt: IranKetabDiscoverySource.lastCrawledAt,
  nextCrawlAt: IranKetabDiscoverySource.nextCrawlAt,
  lastSuccessAt: IranKetabDiscoverySource.lastSuccessAt,
  lastErrorCode: IranKetabDiscoverySource.lastErrorCode,
  lastErrorMessage: IranKetabDiscoverySource.lastErrorMessage,
  discoveredBookCount: IranKetabDiscoverySource.discoveredBookCount,
  newBookCount: IranKetabDiscoverySource.newBookCount,
  metadata: IranKetabDiscoverySource.metadata,
  createdById: IranKetabDiscoverySource.createdById,
  createdByName: User.name,
  createdAt: IranKetabDiscoverySource.createdAt,
  updatedAt: IranKetabDiscoverySource.updatedAt,
};

export async function listIranKetabDiscoverySources(input: {
  q?: string;
  sourceType?: (typeof IranKetabDiscoverySource.$inferSelect)["sourceType"];
  crawlStatus?: (typeof IranKetabDiscoverySource.$inferSelect)["crawlStatus"];
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.max(
    1,
    Math.min(100, Math.trunc(input.pageSize ?? IRANKETAB_DISCOVERY_SOURCE_PAGE_SIZE)),
  );
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const conditions: SQL[] = [];

  if (input.q?.trim()) {
    const term = `%${input.q.trim()}%`;
    conditions.push(
      or(
        ilike(IranKetabDiscoverySource.name, term),
        ilike(IranKetabDiscoverySource.sourceKey, term),
        ilike(IranKetabDiscoverySource.sourceUrl, term),
      )!,
    );
  }
  if (input.sourceType) {
    conditions.push(eq(IranKetabDiscoverySource.sourceType, input.sourceType));
  }
  if (input.crawlStatus) {
    conditions.push(
      eq(IranKetabDiscoverySource.crawlStatus, input.crawlStatus),
    );
  }
  if (input.enabled !== undefined) {
    conditions.push(eq(IranKetabDiscoverySource.enabled, input.enabled));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const [sources, totals] = await Promise.all([
    db
      .select(sourceSelection)
      .from(IranKetabDiscoverySource)
      .leftJoin(User, eq(IranKetabDiscoverySource.createdById, User.id))
      .where(where)
      .orderBy(
        desc(IranKetabDiscoverySource.enabled),
        desc(IranKetabDiscoverySource.importance),
        desc(IranKetabDiscoverySource.updatedAt),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(IranKetabDiscoverySource)
      .where(where),
  ]);

  const total = totals[0]?.total ?? 0;
  return {
    sources,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getIranKetabDiscoverySource(id: string) {
  const [source] = await db
    .select(sourceSelection)
    .from(IranKetabDiscoverySource)
    .leftJoin(User, eq(IranKetabDiscoverySource.createdById, User.id))
    .where(eq(IranKetabDiscoverySource.id, id))
    .limit(1);
  if (!source) return null;

  const [membershipCounts, recentRuns] = await Promise.all([
    db
      .select({ total: count() })
      .from(IranKetabDiscoveryMembership)
      .where(eq(IranKetabDiscoveryMembership.discoverySourceId, id)),
    db
      .select({
        id: IranKetabDiscoveryRun.id,
        status: IranKetabDiscoveryRun.status,
        startedAt: IranKetabDiscoveryRun.startedAt,
        completedAt: IranKetabDiscoveryRun.completedAt,
        pagesFetched: IranKetabDiscoveryRun.pagesFetched,
        booksFound: IranKetabDiscoveryRun.booksFound,
        itemsInserted: IranKetabDiscoveryRun.itemsInserted,
        itemsUpdated: IranKetabDiscoveryRun.itemsUpdated,
        errorCode: IranKetabDiscoveryRun.errorCode,
        errorMessage: IranKetabDiscoveryRun.errorMessage,
      })
      .from(IranKetabDiscoveryRun)
      .where(eq(IranKetabDiscoveryRun.discoverySourceId, id))
      .orderBy(desc(IranKetabDiscoveryRun.startedAt))
      .limit(10),
  ]);

  return {
    ...source,
    membershipCount: membershipCounts[0]?.total ?? 0,
    recentRuns,
  };
}

export async function createIranKetabDiscoverySource(
  input: IranKetabDiscoverySourceInput,
  adminId: string,
) {
  const values = prepareIranKetabDiscoverySourceCreateValues(input);
  await assertSourceIdentityAvailable(values.sourceUrl, values.sourceKey);

  const [source] = await db
    .insert(IranKetabDiscoverySource)
    .values({ ...values, createdById: adminId })
    .returning({ id: IranKetabDiscoverySource.id });
  return source;
}

export async function createOrResumeIranKetabPublisherSource(
  input: IranKetabPublisherSource,
  adminId: string,
) {
  const sourceUrl = canonicalIranKetabDiscoverySourceUrl(input.sourceUrl);
  const sourceKey = input.sourceKey.trim().toLowerCase();
  const [existing] = await db
    .select({
      id: IranKetabDiscoverySource.id,
    })
    .from(IranKetabDiscoverySource)
    .where(
      or(
        eq(IranKetabDiscoverySource.sourceUrl, sourceUrl),
        eq(IranKetabDiscoverySource.sourceKey, sourceKey),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(IranKetabDiscoverySource)
      .set({
        name: input.name,
        sourceType: "PUBLISHER",
        sourceUrl,
        sourceKey,
        importance: 100,
        enabled: true,
        autoQueue: true,
        importMode: "AUTO_IMPORT",
        minimumQueueScore: 0,
        crawlIntervalMinutes: 1440,
        nextCrawlAt: new Date(),
        metadata: { workflow: "PUBLISHER_AUTO_IMPORT" },
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(IranKetabDiscoverySource.id, existing.id));
    return { id: existing.id, reused: true };
  }

  const source = await createIranKetabDiscoverySource(
    {
      name: input.name,
      sourceType: "PUBLISHER",
      sourceUrl,
      sourceKey,
      importance: 100,
      enabled: true,
      crawlIntervalMinutes: 1440,
      autoQueue: true,
      importMode: "AUTO_IMPORT",
      minimumQueueScore: 0,
      parserVersion: 1,
      nextCrawlAt: new Date(),
      metadata: { workflow: "PUBLISHER_AUTO_IMPORT" },
    },
    adminId,
  );
  return { id: source.id, reused: false };
}

export async function updateIranKetabDiscoverySource(
  id: string,
  input: UpdateIranKetabDiscoverySourceInput,
) {
  const [current] = await db
    .select({ id: IranKetabDiscoverySource.id })
    .from(IranKetabDiscoverySource)
    .where(eq(IranKetabDiscoverySource.id, id))
    .limit(1);
  if (!current) throw new IranKetabDiscoverySourceError("DISCOVERY_SOURCE_NOT_FOUND");

  const values = normalizeSourceInput(input);
  if (values.sourceUrl !== undefined || values.sourceKey !== undefined) {
    await assertSourceIdentityAvailable(values.sourceUrl, values.sourceKey, id);
  }

  await db
    .update(IranKetabDiscoverySource)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(IranKetabDiscoverySource.id, id));
}

export async function setIranKetabDiscoverySourceEnabled(
  id: string,
  enabled: boolean,
) {
  const [updated] = await db
    .update(IranKetabDiscoverySource)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(IranKetabDiscoverySource.id, id))
    .returning({ id: IranKetabDiscoverySource.id, enabled: IranKetabDiscoverySource.enabled });
  if (!updated) throw new IranKetabDiscoverySourceError("DISCOVERY_SOURCE_NOT_FOUND");
  return updated;
}

/** Sources with discovery evidence are retained for provenance and should be disabled instead. */
export async function deleteIranKetabDiscoverySource(id: string) {
  const [[membershipCount], [runCount]] = await Promise.all([
    db
      .select({ total: count() })
      .from(IranKetabDiscoveryMembership)
      .where(eq(IranKetabDiscoveryMembership.discoverySourceId, id)),
    db
      .select({ total: count() })
      .from(IranKetabDiscoveryRun)
      .where(eq(IranKetabDiscoveryRun.discoverySourceId, id)),
  ]);
  if ((membershipCount?.total ?? 0) > 0 || (runCount?.total ?? 0) > 0)
    throw new IranKetabDiscoverySourceError("DISCOVERY_SOURCE_NOT_EMPTY");

  const [deleted] = await db
    .delete(IranKetabDiscoverySource)
    .where(eq(IranKetabDiscoverySource.id, id))
    .returning({ id: IranKetabDiscoverySource.id });
  if (!deleted) throw new IranKetabDiscoverySourceError("DISCOVERY_SOURCE_NOT_FOUND");
  return deleted;
}

function normalizeSourceInput(
  input: Partial<IranKetabDiscoverySourceInput>,
) {
  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
    ...(input.sourceUrl !== undefined
      ? { sourceUrl: canonicalIranKetabDiscoverySourceUrl(input.sourceUrl) }
      : {}),
    ...(input.sourceKey !== undefined
      ? { sourceKey: input.sourceKey.trim().toLowerCase() }
      : {}),
    ...(input.importance !== undefined ? { importance: input.importance } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.crawlIntervalMinutes !== undefined
      ? { crawlIntervalMinutes: input.crawlIntervalMinutes }
      : {}),
    ...(input.autoQueue !== undefined ? { autoQueue: input.autoQueue } : {}),
    ...(input.importMode !== undefined ? { importMode: input.importMode } : {}),
    ...(input.minimumQueueScore !== undefined
      ? { minimumQueueScore: input.minimumQueueScore }
      : {}),
    ...(input.parserVersion !== undefined
      ? { parserVersion: input.parserVersion }
      : {}),
    ...(input.nextCrawlAt !== undefined
      ? { nextCrawlAt: input.nextCrawlAt }
      : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}

async function assertSourceIdentityAvailable(
  sourceUrl?: string,
  sourceKey?: string,
  excludeId?: string,
) {
  if (!sourceUrl && !sourceKey) return;
  const matches = [];
  if (sourceUrl) matches.push(eq(IranKetabDiscoverySource.sourceUrl, sourceUrl));
  if (sourceKey) matches.push(eq(IranKetabDiscoverySource.sourceKey, sourceKey));
  const rows = await db
    .select({ id: IranKetabDiscoverySource.id })
    .from(IranKetabDiscoverySource)
    .where(or(...matches))
    .limit(1);
  if (rows[0] && rows[0].id !== excludeId)
    throw new IranKetabDiscoverySourceError("DISCOVERY_SOURCE_ALREADY_EXISTS");
}
