import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { readFormDataBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { COVER_UPLOAD_MAX_BYTES } from "@/lib/admin/book-covers.shared";
import {
  attachUploadedCoverToEdition,
  buildEditionCoverUploadFilename,
  getAdminBookCoverEditionById,
} from "@/lib/admin/book-covers";
import { apiError, apiSuccess } from "@/lib/api/response";
import { StorageError, uploadImageToS3 } from "@/lib/server/s3";
import { validateImageFile } from "@/lib/upload";

export const runtime = "nodejs";

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ editionId: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { editionId } = await params;
  const current = await getAdminBookCoverEditionById(editionId);
  if (!current) {
    return apiError("نسخه پیدا نشد.", 404, "EDITION_NOT_FOUND");
  }

  let formData: FormData;
  try {
    formData = await readFormDataBody(req, 12 * 1024 * 1024);
  } catch (error) {
    return apiError(error instanceof RequestError ? error.message : "درخواست نامعتبر است", error instanceof RequestError ? error.status : 400);
  }
  const file = formData.get("file");
  const replaceExisting = formData.get("replaceExisting") === "true";

  if (!(file instanceof File)) {
    return apiError("فایل تصویر ارسال نشده است.", 400, "FILE_REQUIRED");
  }

  const validationError = validateImageFile(file, COVER_UPLOAD_MAX_BYTES);
  if (validationError) {
    return apiError(validationError, 400, "INVALID_IMAGE_FILE");
  }

  if (current.coverStatus === "uploaded" && !replaceExisting) {
    return apiError(
      "برای این نسخه قبلاً کاور آپلود شده است. برای جایگزینی تأیید لازم است.",
      409,
      "COVER_ALREADY_EXISTS",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const upload = await uploadImageToS3({
      buffer,
      contentType: file.type,
      filename: file.name,
      folder: "covers",
      objectKey: buildEditionCoverUploadFilename({
        fileName: file.name,
        preferredFilename: current.coverFilename,
        bookTitle: current.bookTitle,
        publisher: current.publisher,
        translator: current.translator,
      }),
    });

    await attachUploadedCoverToEdition(current.id, upload.url);
    const updated = await getAdminBookCoverEditionById(current.id);

    return apiSuccess({
      item: updated,
      storage: { driver: "s3", key: upload.key, url: upload.url },
      message: "کاور نسخه با موفقیت در فضای ذخیره‌سازی اصلی آپلود و ثبت شد.",
    });
  } catch (error) {
    console.error("single cover upload failed:", error);
    if (error instanceof StorageError) {
      return apiError(
        "آپلود کاور در فضای ذخیره‌سازی اصلی انجام نشد. اطلاعات نسخه تغییر نکرد.",
        503,
        error.code,
      );
    }
    return apiError("آپلود کاور ناموفق بود و چیزی ذخیره نشد.", 500, "UPLOAD_FAILED");
  }
}

export const POST = withPublicContentInvalidation(handlePOST);
