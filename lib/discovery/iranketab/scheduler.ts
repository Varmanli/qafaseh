import { and, desc, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { IranKetabDiscoveryItem, IranKetabDiscoveryMembership, IranKetabDiscoverySource } from "@/db/schema";
import { enqueueManyDiscoveryItems } from "./import-queue";
import { runDiscoverySource } from "./discovery-service";
import {
  calculateNextCrawlAt,
  isAutoQueueEligible,
  selectDueDiscoverySources,
} from "./scheduler-policy";

const DISCOVERY_SOURCE_LEASE_MS = 30 * 60_000;
const DEFAULT_SCHEDULER_SOURCE_BATCH_SIZE = 10;

export class IranKetabDiscoveryScheduleError extends Error {
  constructor(
    public readonly code:
      | "DISCOVERY_SOURCE_NOT_FOUND"
      | "DISCOVERY_SOURCE_DISABLED"
      | "DISCOVERY_SOURCE_BUSY",
    message: string,
  ) {
    super(message);
    this.name = "IranKetabDiscoveryScheduleError";
  }
}

export { calculateNextCrawlAt, isAutoQueueEligible, selectDueDiscoverySources } from "./scheduler-policy";

/**
 * Performs one bounded scheduling pass. A cron invocation can call this
 * function; it intentionally does not start an import worker or commit books.
 */
export async function runScheduledDiscovery() {
  const now = new Date();
  const candidates = await db
    .select({
      id: IranKetabDiscoverySource.id,
      enabled: IranKetabDiscoverySource.enabled,
      crawlStatus: IranKetabDiscoverySource.crawlStatus,
      crawlLeaseExpiresAt: IranKetabDiscoverySource.crawlLeaseExpiresAt,
      nextCrawlAt: IranKetabDiscoverySource.nextCrawlAt,
      crawlIntervalMinutes: IranKetabDiscoverySource.crawlIntervalMinutes,
      autoQueue: IranKetabDiscoverySource.autoQueue,
      minimumQueueScore: IranKetabDiscoverySource.minimumQueueScore,
    })
    .from(IranKetabDiscoverySource)
    .where(
      and(
        eq(IranKetabDiscoverySource.enabled, true),
        or(
          ne(IranKetabDiscoverySource.sourceType, "PUBLISHER"),
          ne(IranKetabDiscoverySource.importMode, "AUTO_IMPORT"),
          eq(IranKetabDiscoverySource.publisherImportStatus, "RUNNING"),
        ),
        or(
          ne(IranKetabDiscoverySource.crawlStatus, "RUNNING"),
          isNull(IranKetabDiscoverySource.crawlLeaseExpiresAt),
          lte(IranKetabDiscoverySource.crawlLeaseExpiresAt, now),
        ),
        lte(IranKetabDiscoverySource.nextCrawlAt, now),
      ),
    )
    .orderBy(IranKetabDiscoverySource.nextCrawlAt)
    .limit(schedulerSourceBatchSize());

  const dueSources = selectDueDiscoverySources(candidates, now);
  const results = [];
  for (const source of dueSources) {
    const [claimed] = await db
      .update(IranKetabDiscoverySource)
      .set({
        crawlStatus: "RUNNING",
        crawlLeaseExpiresAt: new Date(now.getTime() + DISCOVERY_SOURCE_LEASE_MS),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(IranKetabDiscoverySource.id, source.id),
          eq(IranKetabDiscoverySource.enabled, true),
          or(
            ne(IranKetabDiscoverySource.sourceType, "PUBLISHER"),
            ne(IranKetabDiscoverySource.importMode, "AUTO_IMPORT"),
            eq(IranKetabDiscoverySource.publisherImportStatus, "RUNNING"),
          ),
          or(
            ne(IranKetabDiscoverySource.crawlStatus, "RUNNING"),
            isNull(IranKetabDiscoverySource.crawlLeaseExpiresAt),
            lte(IranKetabDiscoverySource.crawlLeaseExpiresAt, now),
          ),
          lte(IranKetabDiscoverySource.nextCrawlAt, now),
        ),
      )
      .returning({ id: IranKetabDiscoverySource.id });
    if (!claimed) continue;

    try {
      const run = await runDiscoverySource(source.id);
      const queueResults = source.autoQueue
        ? await enqueueEligibleSourceItems(source.id, source.minimumQueueScore)
        : [];
      await scheduleSource(source.id, source.crawlIntervalMinutes, now);
      results.push({ sourceId: source.id, status: "SUCCEEDED" as const, run, queueResults });
    } catch (error) {
      // The runner has already recorded its run/source failure. Advance the
      // schedule so a bad source does not create a tight scheduler loop.
      const errorCode = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "DISCOVERY_RUN_FAILED";
      const errorMessage = error instanceof Error ? error.message : "اجرای کشف منبع ناموفق بود.";
      await db
        .update(IranKetabDiscoverySource)
        .set({ crawlStatus: "FAILED", crawlLeaseExpiresAt: null, lastErrorCode: errorCode, lastErrorMessage: errorMessage, updatedAt: new Date() })
        .where(and(eq(IranKetabDiscoverySource.id, source.id), eq(IranKetabDiscoverySource.crawlStatus, "RUNNING")));
      await scheduleSource(source.id, source.crawlIntervalMinutes, now);
      results.push({
        sourceId: source.id,
        status: "FAILED" as const,
        errorCode,
        errorMessage,
      });
    }
  }
  return { ranAt: now, dueCount: dueSources.length, results };
}

function schedulerSourceBatchSize() {
  const configured = Number(process.env.IRANKETAB_DISCOVERY_SCHEDULER_SOURCE_BATCH_SIZE ?? DEFAULT_SCHEDULER_SOURCE_BATCH_SIZE);
  return Math.max(1, Math.min(25, Number.isFinite(configured) ? Math.trunc(configured) : DEFAULT_SCHEDULER_SOURCE_BATCH_SIZE));
}

/**
 * Runs one enabled source on demand. Unlike the scheduler this intentionally
 * ignores nextCrawlAt, but it uses the same lease so concurrent schedulers and
 * admins cannot run a source twice.
 */
export async function runManualDiscoverySource(sourceId: string) {
  const now = new Date();
  const [source] = await db
    .select({
      id: IranKetabDiscoverySource.id,
      enabled: IranKetabDiscoverySource.enabled,
      crawlStatus: IranKetabDiscoverySource.crawlStatus,
      crawlLeaseExpiresAt: IranKetabDiscoverySource.crawlLeaseExpiresAt,
      crawlIntervalMinutes: IranKetabDiscoverySource.crawlIntervalMinutes,
      autoQueue: IranKetabDiscoverySource.autoQueue,
      minimumQueueScore: IranKetabDiscoverySource.minimumQueueScore,
    })
    .from(IranKetabDiscoverySource)
    .where(eq(IranKetabDiscoverySource.id, sourceId))
    .limit(1);
  if (!source) throw new IranKetabDiscoveryScheduleError("DISCOVERY_SOURCE_NOT_FOUND", "منبع کشف یافت نشد.");
  if (!source.enabled) throw new IranKetabDiscoveryScheduleError("DISCOVERY_SOURCE_DISABLED", "منبع کشف غیرفعال است.");

  const [claimed] = await db
    .update(IranKetabDiscoverySource)
    .set({
      crawlStatus: "RUNNING",
      crawlLeaseExpiresAt: new Date(now.getTime() + DISCOVERY_SOURCE_LEASE_MS),
      updatedAt: now,
    })
    .where(
      and(
        eq(IranKetabDiscoverySource.id, source.id),
        eq(IranKetabDiscoverySource.enabled, true),
        or(
          ne(IranKetabDiscoverySource.crawlStatus, "RUNNING"),
          isNull(IranKetabDiscoverySource.crawlLeaseExpiresAt),
          lte(IranKetabDiscoverySource.crawlLeaseExpiresAt, now),
        ),
      ),
    )
    .returning({ id: IranKetabDiscoverySource.id });
  if (!claimed) throw new IranKetabDiscoveryScheduleError("DISCOVERY_SOURCE_BUSY", "این منبع هم‌اکنون در حال اجرا است.");

  try {
    const run = await runDiscoverySource(source.id);
    const queueResults = source.autoQueue
      ? await enqueueEligibleSourceItems(source.id, source.minimumQueueScore)
      : [];
    await scheduleSource(source.id, source.crawlIntervalMinutes, now);
    return { sourceId: source.id, status: "SUCCEEDED" as const, run, queueResults };
  } catch (error) {
    const errorCode = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "DISCOVERY_RUN_FAILED";
    const errorMessage = error instanceof Error ? error.message : "اجرای کشف منبع ناموفق بود.";
    await db
      .update(IranKetabDiscoverySource)
      .set({ crawlStatus: "FAILED", crawlLeaseExpiresAt: null, lastErrorCode: errorCode, lastErrorMessage: errorMessage, updatedAt: new Date() })
      .where(and(eq(IranKetabDiscoverySource.id, source.id), eq(IranKetabDiscoverySource.crawlStatus, "RUNNING")));
    await scheduleSource(source.id, source.crawlIntervalMinutes, now);
    return { sourceId: source.id, status: "FAILED" as const, errorCode, errorMessage };
  }
}

async function scheduleSource(sourceId: string, crawlIntervalMinutes: number, now: Date) {
  await db
    .update(IranKetabDiscoverySource)
    .set({ nextCrawlAt: calculateNextCrawlAt(now, crawlIntervalMinutes), updatedAt: new Date() })
    .where(eq(IranKetabDiscoverySource.id, sourceId));
}

async function enqueueEligibleSourceItems(sourceId: string, minimumQueueScore: number) {
  const items = await db
    .select({ id: IranKetabDiscoveryItem.id, status: IranKetabDiscoveryItem.status, priorityScore: IranKetabDiscoveryItem.priorityScore, importConfidence: IranKetabDiscoveryItem.importConfidence, sourceType: IranKetabDiscoverySource.sourceType, importMode: IranKetabDiscoverySource.importMode })
    .from(IranKetabDiscoveryItem)
    .innerJoin(IranKetabDiscoveryMembership, eq(IranKetabDiscoveryMembership.discoveryItemId, IranKetabDiscoveryItem.id))
    .innerJoin(IranKetabDiscoverySource, eq(IranKetabDiscoverySource.id, IranKetabDiscoveryMembership.discoverySourceId))
    .where(and(eq(IranKetabDiscoveryMembership.discoverySourceId, sourceId), eq(IranKetabDiscoveryItem.status, "SCORED"), or(and(eq(IranKetabDiscoverySource.sourceType, "PUBLISHER"), eq(IranKetabDiscoverySource.importMode, "AUTO_IMPORT")), and(eq(IranKetabDiscoveryItem.importConfidence, "HIGH"), gte(IranKetabDiscoveryItem.priorityScore, minimumQueueScore)))))
    .orderBy(desc(IranKetabDiscoveryItem.priorityScore));
  const eligible = items.filter((item) => item.sourceType === "PUBLISHER" && item.importMode === "AUTO_IMPORT" || isAutoQueueEligible(item, minimumQueueScore));
  if (!eligible.length) return [];
  await db
    .update(IranKetabDiscoveryItem)
    .set({ status: "QUEUED", updatedAt: new Date() })
    .where(inArray(IranKetabDiscoveryItem.id, eligible.map((item) => item.id)));
  return enqueueManyDiscoveryItems(eligible.map((item) => item.id), sourceId);
}
