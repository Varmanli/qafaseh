import { readFormDataBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { z } from "zod";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { uploadReferenceMedia } from "@/lib/reference/profile-import";
import { StorageError } from "@/lib/server/s3";

export const runtime = "nodejs";

const matchSchema = z.object({
  filename: z.string().min(1),
  relativePath: z.string().nullish(),
  referenceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let formData: FormData;
  try {
    formData = await readFormDataBody(req, 128 * 1024 * 1024);
  } catch (error) {
    return apiError(error instanceof RequestError ? error.message : "درخواست نامعتبر است", error instanceof RequestError ? error.status : 400);
  }
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return apiError("هیچ فایل تصویری برای آپلود ارسال نشده است.", 400, "NO_MEDIA_FILES");
  }

  const rawMatches = formData.get("matches");
  if (typeof rawMatches !== "string" || !rawMatches.trim()) {
    return apiError("نقشه‌ی اتصال فایل‌ها ارسال نشده است.", 422, "MISSING_MATCH_MAP");
  }

  let parsedMatches: z.infer<typeof matchSchema>[];
  try {
    const decoded = JSON.parse(rawMatches);
    const parsed = z.array(matchSchema).safeParse(decoded);
    if (!parsed.success) {
      return apiError("نقشه‌ی اتصال فایل‌ها معتبر نیست.", 422, "INVALID_MATCH_MAP");
    }
    parsedMatches = parsed.data;
  } catch {
    return apiError("نقشه‌ی اتصال فایل‌ها معتبر نیست.", 422, "INVALID_MATCH_MAP");
  }

  try {
    const result = await uploadReferenceMedia(files, parsedMatches);
    return apiSuccess({ ...result });
  } catch (error) {
    if (error instanceof StorageError) {
      console.error("Reference media upload failed", {
        code: error.code,
        fileCount: files.length,
      });
      if (error.code === "STORAGE_CONFIG") {
        return apiError(
          "پیکربندی فضای ذخیره‌سازی ناقص است. متغیرهای S3 را بررسی کنید.",
          503,
          error.code,
        );
      }
      return apiError("آپلود در فضای ذخیره‌سازی ناموفق بود.", 503, error.code);
    }
    console.error("Reference media upload failed", { fileCount: files.length });
    return apiError("آپلود رسانه ناموفق بود.", 500, "REFERENCE_MEDIA_UPLOAD_FAILED");
  }
}
