import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { retryPublisherImportFailures } from "@/lib/discovery/iranketab/import-queue";
import {
  activateIranKetabPublisherImport,
  IranKetabDiscoverySourceError,
  pauseIranKetabPublisherImport,
} from "@/lib/discovery/iranketab/source-service";
import { iranKetabPublisherControlSchema } from "@/lib/validations/iranketab-discovery";

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const parsed = iranKetabPublisherControlSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return apiError(parsed.error.issues[0]?.message ?? "فرمان نامعتبر است", 422, "INVALID_PUBLISHER_CONTROL");

  try {
    if (parsed.data.action === "PAUSE") {
      const source = await pauseIranKetabPublisherImport(parsed.data.sourceId);
      return apiSuccess({ source, message: "ورود ناشر پس از پایان کتاب جاری متوقف می‌شود." });
    }
    const source = await activateIranKetabPublisherImport(parsed.data.sourceId);
    const retry = parsed.data.action === "RETRY_FAILED"
      ? await retryPublisherImportFailures(parsed.data.sourceId)
      : null;
    return apiSuccess({ source, retry, message: retry ? `${retry.requeued} مورد دوباره در صف قرار گرفت.` : "ورود ناشر ادامه پیدا کرد." });
  } catch (error) {
    if (error instanceof IranKetabDiscoverySourceError) {
      if (error.code === "DISCOVERY_SOURCE_NOT_FOUND")
        return apiError("منبع ناشر یافت نشد", 404, error.code);
      if (error.code === "INVALID_PUBLISHER_SOURCE")
        return apiError("این منبع برای ورود خودکار ناشر نیست", 422, error.code);
    }
    throw error;
  }
}
