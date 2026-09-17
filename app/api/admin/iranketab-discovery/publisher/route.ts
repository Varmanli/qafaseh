import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { runManualDiscoverySource, IranKetabDiscoveryScheduleError } from "@/lib/discovery/iranketab/scheduler";
import { activateIranKetabPublisherImport, createOrResumeIranKetabPublisherSource, pauseIranKetabPublisherImport } from "@/lib/discovery/iranketab/source-service";
import { parseIranKetabPublisherSource } from "@/lib/discovery/iranketab/publisher-source";
import { iranKetabPublisherImportSchema } from "@/lib/validations/iranketab-discovery";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const parsed = iranKetabPublisherImportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "لینک انتشارات معتبر نیست", 422);

  let publisher: ReturnType<typeof parseIranKetabPublisherSource>;
  try {
    publisher = parseIranKetabPublisherSource(parsed.data.url);
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "INVALID_PUBLISHER_URL";
    return apiError(error instanceof Error ? error.message : "لینک انتشارات معتبر نیست", 422, code);
  }

  try {
    const source = await createOrResumeIranKetabPublisherSource(publisher, gate.user.id);
    await activateIranKetabPublisherImport(source.id);
    const result = await runManualDiscoverySource(source.id);
    if (result.status === "FAILED") {
      await pauseIranKetabPublisherImport(source.id);
      return apiError(result.errorMessage, 502, result.errorCode);
    }
    return apiSuccess({ source, result, message: "ورود خودکار کتاب‌های انتشارات شروع شد." });
  } catch (error) {
    if (error instanceof IranKetabDiscoveryScheduleError) {
      return apiError(error.message, error.code === "DISCOVERY_SOURCE_BUSY" ? 409 : 422, error.code);
    }
    return apiError("شروع ورود خودکار انتشارات ناموفق بود", 500, "PUBLISHER_IMPORT_FAILED");
  }
}
