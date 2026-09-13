import { and, asc, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import { databaseDiagnosticTarget, db } from "@/db";
import { IranKetabDiscoveryImportJob, IranKetabDiscoveryItem, IranKetabDiscoveryMembership, IranKetabDiscoverySource, IranKetabImportSession, IranKetabPreviewOperation } from "@/db/schema";
import { commitIranKetabImportSession, IranKetabCommitServiceError } from "@/lib/importers/iranketab/commit-service";
import {
  IranKetabDiscoveryImportBridgeError,
  startDiscoveryImport,
} from "./import-bridge";
import { canonicalIranKetabSourceIdentity } from "@/lib/importers/iranketab/server-hardening";

export const IRANKETAB_DISCOVERY_IMPORT_JOB_PAGE_SIZE = 25;
export const IRANKETAB_DISCOVERY_IMPORT_JOB_MAX_ATTEMPTS = 3;
export const IRANKETAB_DISCOVERY_IMPORT_JOB_LEASE_MS = 10 * 60_000;
const PUBLISHER_RECOVERY_MARKER = "publisherAutoRecoveryV3";
const PUBLISHER_TRANSIENT_ERRORS = [
  "این کتاب هم‌اکنون در حال دریافت است.",
  "کاور آماده‌شده نیازمند آماده‌سازی مجدد است.",
  "فقط نامزدهای تأییدشده برای ورود قابل آماده‌سازی هستند.",
] as const;

type JobStatus = (typeof IranKetabDiscoveryImportJob.$inferSelect)["status"];
type ClaimedJobRow = {
  id: string;
  discoveryItemId: string;
  discoverySourceId: string | null;
};
type WorkerRuntimeContext = {
  candidate: Pick<typeof IranKetabDiscoveryItem.$inferSelect, "status" | "importSessionId"> | null;
  source: Pick<typeof IranKetabDiscoverySource.$inferSelect, "id" | "name" | "importMode"> | null;
  sessionStatus: (typeof IranKetabImportSession.$inferSelect)["status"] | null;
};

export class IranKetabDiscoveryImportQueueError extends Error {
  constructor(
    public readonly code:
      | "DISCOVERY_ITEM_NOT_FOUND"
      | "DISCOVERY_ITEM_NOT_QUEUED"
      | "DISCOVERY_SOURCE_REQUIRED"
      | "DISCOVERY_SOURCE_NOT_FOUND"
      | "IMPORT_JOB_NOT_FOUND"
      | "IMPORT_JOB_NOT_CANCELLABLE"
      | "IMPORT_JOB_NOT_RETRYABLE",
  ) {
    super(code);
  }
}

export async function enqueueDiscoveryItem(discoveryItemId: string, discoverySourceId?: string) {
  const [item] = await db
    .select({ id: IranKetabDiscoveryItem.id, status: IranKetabDiscoveryItem.status, priorityScore: IranKetabDiscoveryItem.priorityScore })
    .from(IranKetabDiscoveryItem)
    .where(eq(IranKetabDiscoveryItem.id, discoveryItemId))
    .limit(1);
  if (!item) throw new IranKetabDiscoveryImportQueueError("DISCOVERY_ITEM_NOT_FOUND");
  if (item.status !== "QUEUED")
    throw new IranKetabDiscoveryImportQueueError("DISCOVERY_ITEM_NOT_QUEUED");
  if (discoverySourceId) {
    const [membership] = await db.select({ id: IranKetabDiscoveryMembership.id })
      .from(IranKetabDiscoveryMembership)
      .where(and(eq(IranKetabDiscoveryMembership.discoveryItemId, discoveryItemId), eq(IranKetabDiscoveryMembership.discoverySourceId, discoverySourceId)))
      .limit(1);
    if (!membership) throw new IranKetabDiscoveryImportQueueError("DISCOVERY_ITEM_NOT_FOUND");
  }

  const active = await findActiveJob(discoveryItemId);
  if (active) {
    queueLog("enqueue_reused_active_job", { discoveryItemId, discoverySourceId: active.discoverySourceId, requestedDiscoverySourceId: discoverySourceId ?? null, jobId: active.id, status: active.status });
    return { job: active, reused: true };
  }
  try {
    const [job] = await db
      .insert(IranKetabDiscoveryImportJob)
      .values({ discoveryItemId, discoverySourceId: discoverySourceId ?? null, priority: item.priorityScore, maxAttempts: IRANKETAB_DISCOVERY_IMPORT_JOB_MAX_ATTEMPTS })
      .returning();
    queueLog("enqueue_inserted_job", { discoveryItemId, discoverySourceId: job!.discoverySourceId, jobId: job!.id, priority: item.priorityScore });
    return { job, reused: false };
  } catch (error) {
    // The partial unique index is the concurrency-safe duplicate guard.
    const concurrent = await findActiveJob(discoveryItemId);
    if (concurrent) {
      queueLog("enqueue_reused_concurrent_job", { discoveryItemId, jobId: concurrent.id, status: concurrent.status });
      return { job: concurrent, reused: true };
    }
    queueLog("enqueue_insert_failed", { discoveryItemId, error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

export async function enqueueManyDiscoveryItems(ids: string[], discoverySourceId?: string) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  return Promise.all(
    uniqueIds.map(async (discoveryItemId) => {
      try {
        return { discoveryItemId, ...(await enqueueDiscoveryItem(discoveryItemId, discoverySourceId)) };
      } catch (error) {
        return {
          discoveryItemId,
          error: error instanceof IranKetabDiscoveryImportQueueError ? error.code : "IMPORT_JOB_ENQUEUE_FAILED",
        };
      }
    }),
  );
}

/** Approves eligible scored candidates, then relies on the normal queue duplicate guard. */
export async function approveAndEnqueueDiscoveryItems(ids: string[], preferredSourceId?: string) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return { imported: 0, queued: 0, reused: 0, skipped: 0, skippedReasons: [], failed: 0, results: [] as Awaited<ReturnType<typeof enqueueManyDiscoveryItems>> };
  const selected = await db
    .select({ id: IranKetabDiscoveryItem.id, status: IranKetabDiscoveryItem.status, importConfidence: IranKetabDiscoveryItem.importConfidence })
    .from(IranKetabDiscoveryItem)
    .where(inArray(IranKetabDiscoveryItem.id, uniqueIds));
  const eligibleIds = selected
    .filter((item) => ["SCORED", "NEEDS_REVIEW", "QUEUED"].includes(item.status) && item.importConfidence === "HIGH")
    .map((item) => item.id);
  const skippedReasons = selected
    .filter((item) => !eligibleIds.includes(item.id))
    .map((item) => ({ discoveryItemId: item.id, reason: item.importConfidence !== "HIGH" ? "IMPORT_CONFIDENCE_NOT_HIGH" : `STATUS_${item.status}` }));
  for (const id of uniqueIds) if (!selected.some((item) => item.id === id)) skippedReasons.push({ discoveryItemId: id, reason: "DISCOVERY_ITEM_NOT_FOUND" });
  queueLog("bulk_eligibility_checked", { requested: uniqueIds.length, found: selected.length, eligible: eligibleIds.length, skipped: skippedReasons });
  if (eligibleIds.length) {
    await db
      .update(IranKetabDiscoveryItem)
      .set({ status: "QUEUED", failureCode: null, failureReason: null, nextRetryAt: null, leaseExpiresAt: null, updatedAt: new Date() })
      .where(inArray(IranKetabDiscoveryItem.id, eligibleIds));
  }
  const origins = await resolveQueueOrigins(eligibleIds, preferredSourceId);
  const results = await Promise.all(eligibleIds.map(async (discoveryItemId) => {
    try {
      const discoverySourceId = origins.get(discoveryItemId);
      if (!discoverySourceId) throw new IranKetabDiscoveryImportQueueError("DISCOVERY_SOURCE_REQUIRED");
      return { discoveryItemId, ...(await enqueueDiscoveryItem(discoveryItemId, discoverySourceId)) };
    } catch (error) {
      return { discoveryItemId, error: error instanceof IranKetabDiscoveryImportQueueError ? error.code : "IMPORT_JOB_ENQUEUE_FAILED" };
    }
  }));
  const failed = results.filter((result) => "error" in result).length;
  const inserted = results.filter((result) => !("error" in result) && !result.reused).length;
  const reused = results.filter((result) => !("error" in result) && result.reused).length;
  queueLog("bulk_enqueue_completed", { eligible: eligibleIds.length, inserted, reused, failed, errors: results.filter((result) => "error" in result) });
  return { imported: 0, queued: inserted, reused, skipped: skippedReasons.length, skippedReasons, failed, results };
}

/** Selects one exact provenance membership per item; explicit filter wins, then AUTO_IMPORT, then source importance. */
async function resolveQueueOrigins(itemIds: string[], preferredSourceId?: string) {
  const origins = new Map<string, string>();
  if (!itemIds.length) return origins;
  const rows = await db.select({
    discoveryItemId: IranKetabDiscoveryMembership.discoveryItemId,
    discoverySourceId: IranKetabDiscoveryMembership.discoverySourceId,
    importMode: IranKetabDiscoverySource.importMode,
    importance: IranKetabDiscoverySource.importance,
  }).from(IranKetabDiscoveryMembership)
    .innerJoin(IranKetabDiscoverySource, eq(IranKetabDiscoveryMembership.discoverySourceId, IranKetabDiscoverySource.id))
    .where(inArray(IranKetabDiscoveryMembership.discoveryItemId, itemIds));
  rows.sort((a, b) => {
    const preferredA = a.discoverySourceId === preferredSourceId ? 1 : 0;
    const preferredB = b.discoverySourceId === preferredSourceId ? 1 : 0;
    if (preferredA !== preferredB) return preferredB - preferredA;
    const autoA = a.importMode === "AUTO_IMPORT" ? 1 : 0;
    const autoB = b.importMode === "AUTO_IMPORT" ? 1 : 0;
    return autoB - autoA || b.importance - a.importance || a.discoverySourceId.localeCompare(b.discoverySourceId);
  });
  for (const row of rows) if (!origins.has(row.discoveryItemId)) origins.set(row.discoveryItemId, row.discoverySourceId);
  queueLog("bulk_source_origins_resolved", {
    preferredSourceId: preferredSourceId ?? null,
    origins: [...origins].map(([discoveryItemId, discoverySourceId]) => {
      const source = rows.find((row) => row.discoveryItemId === discoveryItemId && row.discoverySourceId === discoverySourceId);
      return { discoveryItemId, discoverySourceId, importMode: source?.importMode ?? null };
    }),
  });
  return origins;
}

/** Atomically selects one runnable job with SKIP LOCKED and attaches a lease. */
export async function claimNextImportJob(workerId: string, discoverySourceId?: string) {
  const now = new Date();
  const leaseExpiredAt = new Date(now.getTime() - IRANKETAB_DISCOVERY_IMPORT_JOB_LEASE_MS);
  await finalizeMissingDiscoveryItemJobs(now);
  await recoverAbandonedImportingItems(leaseExpiredAt, now);
  // Exhausted jobs are terminal before workers consider the next claim.
  const exhausted = await db
    .update(IranKetabDiscoveryImportJob)
    .set({ status: "FAILED", completedAt: now, lastErrorCode: "MAX_ATTEMPTS_EXHAUSTED", lastErrorMessage: "حداکثر دفعات تلاش برای ورود انجام شد.", updatedAt: now })
    .where(
      and(
        gte(IranKetabDiscoveryImportJob.attempts, IranKetabDiscoveryImportJob.maxAttempts),
        or(
          eq(IranKetabDiscoveryImportJob.status, "PENDING"),
          and(
            eq(IranKetabDiscoveryImportJob.status, "PROCESSING"),
            lte(IranKetabDiscoveryImportJob.lockedAt, leaseExpiredAt),
          ),
        ),
      ),
    )
    .returning({ discoveryItemId: IranKetabDiscoveryImportJob.discoveryItemId });
  if (exhausted.length) {
    await db
      .update(IranKetabDiscoveryItem)
      .set({ status: "FAILED", failureCode: "MAX_ATTEMPTS_EXHAUSTED", failureReason: "حداکثر دفعات تلاش برای ورود انجام شد.", updatedAt: now })
      .where(inArray(IranKetabDiscoveryItem.id, exhausted.map((job) => job.discoveryItemId)));
  }

  const scopedSourceId = discoverySourceId ?? (workerId.startsWith("publisher:") ? workerId.slice("publisher:".length) : undefined);
  const sourceFilter = scopedSourceId
    ? sql`AND job."discovery_source_id" = ${scopedSourceId}`
    : sql`AND NOT EXISTS (
        SELECT 1
        FROM "IranKetabDiscoverySource" AS source
        WHERE source."id" = job."discovery_source_id"
          AND source."import_mode" = 'AUTO_IMPORT'
      )`;
  const result = await db.execute(sql`
    WITH candidate AS (
      SELECT "id"
      FROM "IranKetabDiscoveryImportJob" AS job
      WHERE
        (("status" = 'PENDING' AND "available_at" <= ${now} AND "attempts" < "max_attempts")
        OR ("status" = 'PROCESSING' AND "locked_at" <= ${leaseExpiredAt} AND "attempts" < "max_attempts"))
        ${sourceFilter}
      ORDER BY "priority" DESC, "created_at" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "IranKetabDiscoveryImportJob" AS job
    SET "status" = 'PROCESSING',
        "attempts" = job."attempts" + 1,
        "locked_at" = ${now},
        "locked_by" = ${workerId},
        "started_at" = COALESCE(job."started_at", ${now}),
        "updated_at" = ${now}
    FROM candidate
    WHERE job."id" = candidate."id"
    -- Raw SQL returns PostgreSQL snake_case names unless explicitly aliased.
    -- The worker consumes camelCase fields, matching the Drizzle model.
    RETURNING job."id" AS "id", job."discovery_item_id" AS "discoveryItemId", job."discovery_source_id" AS "discoverySourceId"
  `);
  const claimed = ((result as unknown as { rows: ClaimedJobRow[] }).rows[0] ?? null);
  queueLog("worker_claim_attempt", { workerId, claimed: Boolean(claimed), jobId: claimed?.id ?? null, discoveryItemId: claimed?.discoveryItemId ?? null, discoverySourceId: claimed?.discoverySourceId ?? null });
  return claimed;
}

/**
 * The foreign key normally makes this impossible. It protects legacy rows or
 * data created before the constraint from repeatedly being claimed forever.
 */
async function finalizeMissingDiscoveryItemJobs(now: Date) {
  const result = await db.execute(sql`
    UPDATE "IranKetabDiscoveryImportJob" AS job
    SET "status" = 'FAILED',
        "completed_at" = ${now},
        "locked_at" = NULL,
        "locked_by" = NULL,
        "last_error_code" = 'DISCOVERY_ITEM_NOT_FOUND',
        "last_error_message" = 'نامزد کشف مرتبط با این کار ورود دیگر وجود ندارد.',
        "updated_at" = ${now}
    WHERE job."status" IN ('PENDING', 'PROCESSING')
      AND NOT EXISTS (
        SELECT 1
        FROM "IranKetabDiscoveryItem" AS item
        WHERE item."id" = job."discovery_item_id"
      )
    RETURNING job."id" AS "id", job."discovery_item_id" AS "discoveryItemId"
  `);
  const jobs = (result as unknown as { rows: ClaimedJobRow[] }).rows;
  if (jobs.length) queueLog("orphaned_jobs_finalized", { jobs });
}

/** A reclaimed job must not keep its candidate pinned to a stale importer session. */
async function recoverAbandonedImportingItems(leaseExpiredAt: Date, now: Date) {
  await db.execute(sql`
    UPDATE "IranKetabDiscoveryItem" AS item
    SET "status" = 'QUEUED', "lease_expires_at" = NULL, "updated_at" = ${now}
    WHERE item."status" = 'IMPORTING'
      AND EXISTS (
        SELECT 1 FROM "IranKetabDiscoveryImportJob" AS job
        WHERE job."discovery_item_id" = item."id"
          AND job."status" = 'PROCESSING'
          AND job."locked_at" <= ${leaseExpiredAt}
      )
  `);
}

export async function completeImportJob(jobId: string) {
  const [job] = await db
    .update(IranKetabDiscoveryImportJob)
    .set({ status: "COMPLETED", completedAt: new Date(), lockedAt: null, lockedBy: null, updatedAt: new Date() })
    .where(and(eq(IranKetabDiscoveryImportJob.id, jobId), eq(IranKetabDiscoveryImportJob.status, "PROCESSING")))
    .returning();
  if (!job) throw new IranKetabDiscoveryImportQueueError("IMPORT_JOB_NOT_FOUND");
  return job;
}

export async function failImportJob(jobId: string, error: unknown) {
  const [current] = await db
    .select()
    .from(IranKetabDiscoveryImportJob)
    .where(eq(IranKetabDiscoveryImportJob.id, jobId))
    .limit(1);
  if (!current) throw new IranKetabDiscoveryImportQueueError("IMPORT_JOB_NOT_FOUND");
  if (current.status !== "PROCESSING") return current;
  const failure = normalizeError(error);
  const waitForExistingImport = failure.code === "DISCOVERY_IMPORT_ALREADY_RUNNING";
  const retry = !waitForExistingImport && current.attempts < current.maxAttempts && isRetryableQueueFailure(failure.code);
  const requeue = waitForExistingImport || retry;
  const now = new Date();
  const [updated] = await db
    .update(IranKetabDiscoveryImportJob)
    .set({
      status: requeue ? "PENDING" : "FAILED",
      ...(waitForExistingImport ? { attempts: Math.max(0, current.attempts - 1) } : {}),
      availableAt: requeue ? new Date(now.getTime() + retryDelayMs(current.attempts)) : current.availableAt,
      lockedAt: null,
      lockedBy: null,
      completedAt: requeue ? null : now,
      lastErrorCode: failure.code,
      lastErrorMessage: failure.message,
      updatedAt: now,
    })
    .where(and(eq(IranKetabDiscoveryImportJob.id, jobId), eq(IranKetabDiscoveryImportJob.status, "PROCESSING")))
    .returning();
  if (updated && requeue)
    await db
      .update(IranKetabDiscoveryItem)
      .set({ status: "QUEUED", failureCode: failure.code, failureReason: failure.message, updatedAt: now })
      .where(
        and(
          eq(IranKetabDiscoveryItem.id, current.discoveryItemId),
          inArray(IranKetabDiscoveryItem.status, ["FAILED", "NEEDS_REVIEW", "APPROVED", "IMPORTING"]),
        ),
      );
  if (updated && !retry)
    await db
      .update(IranKetabDiscoveryItem)
      .set({ status: "FAILED", failureCode: failure.code, failureReason: failure.message, updatedAt: now })
      .where(eq(IranKetabDiscoveryItem.id, current.discoveryItemId));
  return updated ?? current;
}

export async function cancelImportJob(jobId: string) {
  const [job] = await db
    .update(IranKetabDiscoveryImportJob)
    .set({ status: "CANCELLED", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(IranKetabDiscoveryImportJob.id, jobId), eq(IranKetabDiscoveryImportJob.status, "PENDING")))
    .returning();
  if (!job) throw new IranKetabDiscoveryImportQueueError("IMPORT_JOB_NOT_CANCELLABLE");
  return job;
}

/** An explicit administrator retry starts a fresh bounded attempt cycle but retains the last failure fields. */
export async function retryImportJob(jobId: string) {
  const [current] = await db
    .select({ id: IranKetabDiscoveryImportJob.id, discoveryItemId: IranKetabDiscoveryImportJob.discoveryItemId })
    .from(IranKetabDiscoveryImportJob)
    .where(and(eq(IranKetabDiscoveryImportJob.id, jobId), eq(IranKetabDiscoveryImportJob.status, "FAILED")))
    .limit(1);
  if (!current) throw new IranKetabDiscoveryImportQueueError("IMPORT_JOB_NOT_RETRYABLE");
  const [item] = await db
    .select({ id: IranKetabDiscoveryItem.id })
    .from(IranKetabDiscoveryItem)
    .where(eq(IranKetabDiscoveryItem.id, current.discoveryItemId))
    .limit(1);
  if (!item) {
    await db
      .update(IranKetabDiscoveryImportJob)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        lastErrorCode: "DISCOVERY_ITEM_NOT_FOUND",
        lastErrorMessage: "نامزد کشف مرتبط با این کار ورود دیگر وجود ندارد.",
        updatedAt: new Date(),
      })
      .where(eq(IranKetabDiscoveryImportJob.id, current.id));
    queueLog("retry_rejected_missing_candidate", { jobId: current.id, discoveryItemId: current.discoveryItemId });
    throw new IranKetabDiscoveryImportQueueError("DISCOVERY_ITEM_NOT_FOUND");
  }
  const [job] = await db
    .update(IranKetabDiscoveryImportJob)
    .set({ status: "PENDING", attempts: 0, availableAt: new Date(), lockedAt: null, lockedBy: null, completedAt: null, updatedAt: new Date() })
    .where(and(eq(IranKetabDiscoveryImportJob.id, jobId), eq(IranKetabDiscoveryImportJob.status, "FAILED")))
    .returning();
  if (!job) throw new IranKetabDiscoveryImportQueueError("IMPORT_JOB_NOT_RETRYABLE");
  await db
    .update(IranKetabDiscoveryItem)
    .set({ status: "QUEUED", updatedAt: new Date() })
    .where(
      and(
        eq(IranKetabDiscoveryItem.id, job.discoveryItemId),
        eq(IranKetabDiscoveryItem.status, "FAILED"),
      ),
    );
  return job;
}

/** Processes at most one job. The caller supplies a stable worker/admin identity. */
export async function processDiscoveryImportQueue(workerId: string, actorId = workerId) {
  const job = await claimNextImportJob(workerId);
  if (!job) return { processed: false as const, job: null };
  let workerDecision = "UNDECIDED";
  try {
    const beforeBridge = await loadWorkerRuntimeContext(job);
    workerDecision = !job.discoverySourceId
      ? "REJECT_MISSING_SOURCE"
      : !beforeBridge.source
        ? "REJECT_UNKNOWN_SOURCE"
        : beforeBridge.source.importMode === "AUTO_IMPORT"
          ? "AUTO_IMPORT"
          : "MANUAL_REVIEW";
    logWorkerDecision(job, beforeBridge, workerId, actorId, workerDecision);
    if (!job.discoverySourceId) throw new IranKetabDiscoveryImportQueueError("DISCOVERY_SOURCE_REQUIRED");
    if (!beforeBridge.source) throw new IranKetabDiscoveryImportQueueError("DISCOVERY_SOURCE_NOT_FOUND");

    const result = await startDiscoveryImport(job.discoveryItemId, actorId);
    const afterBridge = await loadWorkerRuntimeContext(job);
    queueLog("worker_bridge_completed", workerLogDetails(job, afterBridge, workerId, actorId, workerDecision));
    if (beforeBridge.source.importMode === "AUTO_IMPORT") {
      queueLog("worker_auto_import_started", workerLogDetails(job, afterBridge, workerId, actorId, workerDecision));
      await commitIranKetabImportSession({ sessionId: result.session.id, adminId: actorId, autoPrepare: true, autoApproveDiscovery: true });
    }
    const afterProcessing = await loadWorkerRuntimeContext(job);
    const completedJob = await completeImportJob(job.id);
    queueLog("worker_job_completed", workerLogDetails(job, afterProcessing, workerId, actorId, workerDecision, "COMPLETED"));
    return { processed: true as const, job: completedJob, result };
  } catch (error) {
    const context = await loadWorkerRuntimeContext(job).catch(() => ({ candidate: null, source: null, sessionStatus: null }));
    const failure = normalizeError(error);
    const failedJob = await failImportJob(job.id, error);
    queueLog("worker_job_failed", { ...workerLogDetails(job, context, workerId, actorId, workerDecision, failedJob.status), error: failure });
    return { processed: true as const, job: failedJob, error: failure };
  }
}

async function loadWorkerRuntimeContext(job: ClaimedJobRow): Promise<WorkerRuntimeContext> {
  const [[candidate], [source]] = await Promise.all([
    db.select({
      status: IranKetabDiscoveryItem.status,
      importSessionId: IranKetabDiscoveryItem.importSessionId,
      sessionStatus: IranKetabImportSession.status,
    }).from(IranKetabDiscoveryItem)
      .leftJoin(IranKetabImportSession, eq(IranKetabDiscoveryItem.importSessionId, IranKetabImportSession.id))
      .where(eq(IranKetabDiscoveryItem.id, job.discoveryItemId))
      .limit(1),
    job.discoverySourceId
      ? db.select({ id: IranKetabDiscoverySource.id, name: IranKetabDiscoverySource.name, importMode: IranKetabDiscoverySource.importMode })
        .from(IranKetabDiscoverySource)
        .where(eq(IranKetabDiscoverySource.id, job.discoverySourceId))
        .limit(1)
      : Promise.resolve([]),
  ]);
  return { candidate: candidate ?? null, source: source ?? null, sessionStatus: candidate?.sessionStatus ?? null };
}

function logWorkerDecision(
  job: ClaimedJobRow,
  context: WorkerRuntimeContext,
  workerId: string,
  actorId: string,
  workerDecision: string,
) {
  queueLog("worker_policy_decision", workerLogDetails(job, context, workerId, actorId, workerDecision));
}

function workerLogDetails(
  job: ClaimedJobRow,
  context: WorkerRuntimeContext,
  workerId: string,
  actorId: string,
  workerDecision: string,
  finalResult?: string,
) {
  return {
    workerId,
    actorId,
    jobId: job.id,
    discoveryItemId: job.discoveryItemId,
    discoverySourceId: job.discoverySourceId,
    sourceName: context.source?.name ?? null,
    importMode: context.source?.importMode ?? null,
    candidateStatus: context.candidate?.status ?? null,
    importSessionId: context.candidate?.importSessionId ?? null,
    sessionStatus: context.sessionStatus,
    workerDecision,
    ...(finalResult ? { finalResult } : {}),
    databaseTarget: databaseDiagnosticTarget(),
  };
}

/** Bounded worker pass for cron/admin invocations; AUTO_IMPORT commits only through commit-service. */
export async function processDiscoveryImportQueueBatch(workerId: string, limit = 10, actorId = workerId, discoverySourceId?: string) {
  if (discoverySourceId) workerId = `publisher:${discoverySourceId}`;
  const results = [];
  for (let index = 0; index < Math.max(0, Math.min(100, Math.trunc(limit))); index += 1) {
    const result = await processDiscoveryImportQueue(workerId, actorId);
    if (!result.processed) break;
    results.push(result);
  }
  return { processed: results.length, results };
}

/** Re-queues one broken publisher run once, after concurrent workers left orphaned previews. */
export async function recoverPublisherImportFailures(discoverySourceId: string) {
  const [source] = await db
    .select({ id: IranKetabDiscoverySource.id, metadata: IranKetabDiscoverySource.metadata })
    .from(IranKetabDiscoverySource)
    .where(eq(IranKetabDiscoverySource.id, discoverySourceId))
    .limit(1);
  if (!source || source.metadata?.[PUBLISHER_RECOVERY_MARKER]) return { requeued: 0 };

  const failed = await db
    .select({ jobId: IranKetabDiscoveryImportJob.id, itemId: IranKetabDiscoveryItem.id, canonicalUrl: IranKetabDiscoveryItem.canonicalUrl })
    .from(IranKetabDiscoveryImportJob)
    .innerJoin(IranKetabDiscoveryItem, eq(IranKetabDiscoveryImportJob.discoveryItemId, IranKetabDiscoveryItem.id))
    .where(and(
      eq(IranKetabDiscoveryImportJob.discoverySourceId, discoverySourceId),
      eq(IranKetabDiscoveryImportJob.status, "FAILED"),
      or(
        and(
          gte(IranKetabDiscoveryImportJob.attempts, IRANKETAB_DISCOVERY_IMPORT_JOB_MAX_ATTEMPTS),
          or(...PUBLISHER_TRANSIENT_ERRORS.slice(0, 2).map((message) => eq(IranKetabDiscoveryImportJob.lastErrorMessage, message))),
        ),
        and(
          gte(IranKetabDiscoveryImportJob.attempts, 1),
          eq(IranKetabDiscoveryImportJob.lastErrorMessage, PUBLISHER_TRANSIENT_ERRORS[2]),
        ),
      ),
    ));
  if (!failed.length) return { requeued: 0 };

  const now = new Date();
  const jobIds = failed.map((row) => row.jobId);
  const itemIds = failed.map((row) => row.itemId);
  const identities = failed.flatMap((row) => {
    try { return [canonicalIranKetabSourceIdentity(row.canonicalUrl)]; } catch { return []; }
  });

  await db.transaction(async (tx) => {
    await tx.update(IranKetabDiscoveryImportJob).set({
      status: "PENDING", attempts: 0, availableAt: now, lockedAt: null, lockedBy: null, completedAt: null, updatedAt: now,
    }).where(and(inArray(IranKetabDiscoveryImportJob.id, jobIds), eq(IranKetabDiscoveryImportJob.status, "FAILED")));
    await tx.update(IranKetabDiscoveryItem).set({
      status: "QUEUED", nextRetryAt: null, leaseExpiresAt: null, updatedAt: now,
    }).where(and(inArray(IranKetabDiscoveryItem.id, itemIds), eq(IranKetabDiscoveryItem.status, "FAILED")));
    if (identities.length) {
      await tx.update(IranKetabPreviewOperation).set({
        status: "FAILED", leaseExpiresAt: null, expiresAt: null, retryable: true, errorCode: "PUBLISHER_AUTO_RECOVERY", errorMessage: "پردازش قبلی ناشر نیمه‌کاره بود و دوباره در صف قرار گرفت.", updatedAt: now,
      }).where(and(inArray(IranKetabPreviewOperation.sourceIdentity, identities), eq(IranKetabPreviewOperation.status, "PROCESSING")));
    }
    await tx.update(IranKetabDiscoverySource).set({
      metadata: { ...(source.metadata ?? {}), [PUBLISHER_RECOVERY_MARKER]: true }, updatedAt: now,
    }).where(eq(IranKetabDiscoverySource.id, discoverySourceId));
  });
  return { requeued: failed.length };
}

function queueLog(event: string, details: Record<string, unknown>) {
  console.info("[iranketab-discovery-queue]", JSON.stringify({ event, ...details }));
}

export async function listDiscoveryImportJobs(input: { page?: number; status?: JobStatus; from?: Date; to?: Date; minimumPriority?: number }) {
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const conditions: SQL[] = [];
  if (input.status) conditions.push(eq(IranKetabDiscoveryImportJob.status, input.status));
  if (input.from) conditions.push(gte(IranKetabDiscoveryImportJob.createdAt, input.from));
  if (input.to) conditions.push(lte(IranKetabDiscoveryImportJob.createdAt, input.to));
  if (input.minimumPriority !== undefined) conditions.push(gte(IranKetabDiscoveryImportJob.priority, input.minimumPriority));
  const where = conditions.length ? and(...conditions) : undefined;
  const [jobs, totalRows] = await Promise.all([
    db.select({ job: IranKetabDiscoveryImportJob, titleHint: IranKetabDiscoveryItem.titleHint, authorHint: IranKetabDiscoveryItem.authorHint, canonicalUrl: IranKetabDiscoveryItem.canonicalUrl, itemStatus: IranKetabDiscoveryItem.status, importSessionId: IranKetabDiscoveryItem.importSessionId, sourceName: IranKetabDiscoverySource.name, importMode: IranKetabDiscoverySource.importMode })
      .from(IranKetabDiscoveryImportJob)
      .leftJoin(IranKetabDiscoveryItem, eq(IranKetabDiscoveryImportJob.discoveryItemId, IranKetabDiscoveryItem.id))
      .leftJoin(IranKetabDiscoverySource, eq(IranKetabDiscoveryImportJob.discoverySourceId, IranKetabDiscoverySource.id))
      .where(where)
      .orderBy(desc(IranKetabDiscoveryImportJob.createdAt), desc(IranKetabDiscoveryImportJob.priority))
      .limit(IRANKETAB_DISCOVERY_IMPORT_JOB_PAGE_SIZE)
      .offset((page - 1) * IRANKETAB_DISCOVERY_IMPORT_JOB_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(IranKetabDiscoveryImportJob).where(where),
  ]);
  const total = totalRows[0]?.total ?? 0;
  return { jobs, total, page, pageSize: IRANKETAB_DISCOVERY_IMPORT_JOB_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / IRANKETAB_DISCOVERY_IMPORT_JOB_PAGE_SIZE)) };
}

export function retryDelayMs(attempts: number) {
  return Math.min(60 * 60_000, 15_000 * 2 ** Math.max(0, attempts - 1));
}

function normalizeError(error: unknown) {
  if (error instanceof IranKetabDiscoveryImportBridgeError) return { code: error.code, message: error.message };
  if (error instanceof IranKetabCommitServiceError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: error.message.slice(0, 120), message: error.message.slice(0, 1_000) };
  return { code: "IMPORT_QUEUE_PROCESSING_FAILED", message: "آماده‌سازی ورود از صف ناموفق بود." };
}

function isRetryableQueueFailure(code: string) {
  return ![
    "DISCOVERY_ITEM_NOT_FOUND",
    "DISCOVERY_ITEM_NOT_QUEUED",
    "DISCOVERY_ITEM_INVALID_URL",
    "DISCOVERY_SOURCE_REQUIRED",
    "DISCOVERY_SOURCE_NOT_FOUND",
    "SESSION_NOT_READY",
    "AUTO_IMPORT_REVIEW_REQUIRED",
    "DISCOVERY_IMPORT_NOT_APPROVED",
  ].includes(code);
}

async function findActiveJob(discoveryItemId: string) {
  const [job] = await db
    .select()
    .from(IranKetabDiscoveryImportJob)
    .where(and(eq(IranKetabDiscoveryImportJob.discoveryItemId, discoveryItemId), inArray(IranKetabDiscoveryImportJob.status, ["PENDING", "PROCESSING"])))
    .orderBy(asc(IranKetabDiscoveryImportJob.createdAt))
    .limit(1);
  return job ?? null;
}
