import { readFormDataBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { parseImportFile } from "@/lib/books/import/file";
import { buildImportPreview } from "@/lib/books/import/validate";

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let formData: FormData;
  try {
    formData = await readFormDataBody(req, 12 * 1024 * 1024);
  } catch (error) {
    if (error instanceof RequestError) return apiError(error.message, error.status);
    return apiError("فایل ارسالی نامعتبر است", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("فایل ورودی پیدا نشد", 400, "IMPORT_FILE_REQUIRED");
  }

  try {
    const books = await parseImportFile(file);
    const preview = await buildImportPreview(books);
    return apiSuccess(preview);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNSUPPORTED_IMPORT_FILE") {
        return apiError("فرمت فایل باید JSON، XLSX یا XLS باشد", 415, "UNSUPPORTED_IMPORT_FILE");
      }
      if (error.message === "JSON_IMPORT_ARRAY_REQUIRED") {
        return apiError("ریشه‌ی فایل JSON باید یک آرایه از کتاب‌ها باشد", 422, "JSON_IMPORT_ARRAY_REQUIRED");
      }
    }
    console.error("admin import preview failed:", error);
    return apiError("پیش‌نمایش فایل ناموفق بود", 500);
  }
}
