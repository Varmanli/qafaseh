import { readFormDataBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { previewReferenceMediaMatches } from "@/lib/reference/profile-import";

export const runtime = "nodejs";

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
    return apiError("هیچ فایل تصویری ارسال نشده است.", 400, "NO_MEDIA_FILES");
  }

  const rawPaths = formData.get("paths");
  let paths: string[] = [];
  if (typeof rawPaths === "string" && rawPaths.trim()) {
    try {
      const parsed = JSON.parse(rawPaths);
      if (Array.isArray(parsed)) {
        paths = parsed.map((item) => (typeof item === "string" ? item : ""));
      }
    } catch {
      return apiError("فهرست مسیر فایل‌ها معتبر نیست.", 422, "INVALID_MEDIA_PATHS");
    }
  }

  const result = await previewReferenceMediaMatches(
    files.map((file, index) => ({
      name: file.name,
      relativePath: paths[index] || null,
    })),
  );

  return apiSuccess({ ...result });
}
