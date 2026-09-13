import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { processDiscoveryImportQueueBatch, recoverPublisherImportFailures } from "@/lib/discovery/iranketab/import-queue";
import { getIranKetabDiscoverySource } from "@/lib/discovery/iranketab/source-service";

export const runtime = "nodejs";
export const maxDuration = 300;

let activePublisherProcessing: Promise<unknown> | null = null;

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null) as { sourceId?: unknown } | null;
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId.trim() : "";
  if (!sourceId) return apiError("شناسهٔ منبع الزامی است", 422, "SOURCE_ID_REQUIRED");

  const source = await getIranKetabDiscoverySource(sourceId);
  if (!source) return apiError("منبع کشف یافت نشد", 404, "DISCOVERY_SOURCE_NOT_FOUND");
  if (source.sourceType !== "PUBLISHER" || source.importMode !== "AUTO_IMPORT")
    return apiError("این منبع برای ورود خودکار ناشر نیست", 422, "INVALID_PUBLISHER_SOURCE");

  if (activePublisherProcessing) return apiSuccess({ imports: { processed: 0, results: [], busy: true } });
  const task = (async () => {
    await recoverPublisherImportFailures(source.id);
    return processDiscoveryImportQueueBatch(`admin-publisher:${gate.user.id}`, 100, gate.user.id, source.id);
  })();
  activePublisherProcessing = task;
  let imports;
  try {
    imports = await task;
  } finally {
    activePublisherProcessing = null;
  }
  return apiSuccess({ imports });
}
