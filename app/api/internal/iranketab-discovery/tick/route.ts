import { apiError, apiSuccess } from "@/lib/api/response";
import { processDiscoveryImportQueueBatch, processPublisherImportQueue } from "@/lib/discovery/iranketab/import-queue";
import { runScheduledDiscovery } from "@/lib/discovery/iranketab/scheduler";
import { getActiveIranKetabPublisherImport } from "@/lib/discovery/iranketab/source-service";
import { assertIranKetabDiscoveryWorkerRequest } from "@/lib/discovery/iranketab/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Invoke from a platform cron or a dedicated worker every minute. It is
 * deliberately bounded and fail-closed; normal admin endpoints stay separate.
 */
export async function POST(request: Request) {
  if (process.env.ENABLE_AUTO_IMPORTER !== "true") {
    return apiError("ورود خودکار کتاب غیرفعال است", 403, "AUTO_IMPORTER_DISABLED");
  }

  const gate = await assertIranKetabDiscoveryWorkerRequest(request);
  if ("error" in gate) return gate.error;

  const discovery = await runScheduledDiscovery();
  const activePublisher = await getActiveIranKetabPublisherImport();
  const publisherImports = activePublisher
    ? await processPublisherImportQueue(
      activePublisher.id,
      `cron-publisher:${gate.actorId}`,
      gate.actorId,
      1,
    )
    : null;
  const imports = await processDiscoveryImportQueueBatch(
    `cron:${gate.actorId}`,
    workerBatchSize(),
    gate.actorId,
  );
  return apiSuccess({ discovery, imports, publisherImports });
}

function workerBatchSize() {
  const configured = Number(process.env.IRANKETAB_DISCOVERY_WORKER_BATCH_SIZE ?? 10);
  return Math.max(1, Math.min(25, Number.isFinite(configured) ? Math.trunc(configured) : 10));
}
