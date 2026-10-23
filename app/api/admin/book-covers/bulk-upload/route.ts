import { readFormDataBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { COVER_UPLOAD_MAX_BYTES } from "@/lib/admin/book-covers.shared";
import {
  attachUploadedCoverToEdition,
  buildEditionCoverUploadFilename,
  getAdminBookCoverEditionById,
  previewBulkCoverMatches,
} from "@/lib/admin/book-covers";
import { apiError, apiSuccess } from "@/lib/api/response";
import { StorageError, uploadImageToS3 } from "@/lib/server/s3";
import { validateImageFile } from "@/lib/upload";

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
  const replaceExisting = formData.get("replaceExisting") === "true";
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return apiError("هیچ فایل تصویری برای آپلود ارسال نشده است.", 400);
  }

  for (const file of files) {
    const validationError = validateImageFile(file, COVER_UPLOAD_MAX_BYTES);
    if (validationError) {
      return apiError(validationError, 400, "INVALID_IMAGE_FILE");
    }
  }

  const preview = await previewBulkCoverMatches(
    files.map((file) => file.name),
    { onlyMissing: !replaceExisting },
  );
  const fileBuckets = new Map<string, File[]>();
  for (const file of files) {
    const bucket = fileBuckets.get(file.name) ?? [];
    bucket.push(file);
    fileBuckets.set(file.name, bucket);
  }

  const uploaded: Array<{
    filename: string;
    editionId: string;
    coverImage: string;
  }> = [];
  const skipped: Array<{
    filename: string;
    reason: string;
    code: string;
  }> = [];

  for (const match of preview.matches) {
    const bucket = fileBuckets.get(match.filename) ?? [];
    const file = bucket.shift();
    if (!file) continue;

    if (bucket.length > 0) {
      skipped.push({
        filename: file.name,
        reason: "چند فایل هم‌نام فرستاده شده بود؛ برای جلوگیری از ابهام رد شد.",
        code: "DUPLICATE_FILENAME",
      });
      fileBuckets.set(match.filename, []);
      continue;
    }

    const current = await getAdminBookCoverEditionById(match.edition.id);
    if (!current) {
      skipped.push({
        filename: file.name,
        reason: "نسخه‌ی مقصد پیدا نشد.",
        code: "EDITION_NOT_FOUND",
      });
      continue;
    }

    if (current.coverStatus === "uploaded" && !replaceExisting) {
      skipped.push({
        filename: file.name,
        reason: "برای این نسخه قبلاً کاور آپلود شده است.",
        code: "COVER_ALREADY_EXISTS",
      });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
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
      uploaded.push({
        filename: file.name,
        editionId: current.id,
        coverImage: upload.url,
      });
    } catch (error) {
      console.error("bulk cover upload failed:", {
        editionId: current.id,
        fileName: file.name,
        error,
      });
      const message =
        error instanceof StorageError
          ? "آپلود در فضای ذخیره‌سازی اصلی انجام نشد و این نسخه تغییر نکرد."
          : "آپلود یا ثبت دیتابیس برای این فایل ناموفق بود.";
      skipped.push({
        filename: file.name,
        reason: message,
        code: error instanceof StorageError ? error.code : "UPLOAD_FAILED",
      });
    }
  }

  for (const item of preview.unmatchedFiles) {
    skipped.push({
      filename: item,
      reason: "برای این فایل نسخه‌ای با نام پیشنهادی متناظر پیدا نشد.",
      code: "UNMATCHED_FILE",
    });
  }

  for (const item of preview.ambiguousFiles) {
    skipped.push({
      filename: item.filename,
      reason: "این نام فایل به چند نسخه می‌خورد و به‌صورت خودکار متصل نشد.",
      code: "AMBIGUOUS_MATCH",
    });
  }

  return apiSuccess({
    uploaded,
    skipped,
    summary: {
      uploadedCount: uploaded.length,
      skippedCount: skipped.length,
    },
    message:
      uploaded.length > 0
        ? "آپلود گروهی کاورها انجام شد."
        : "هیچ کاوری به‌صورت خودکار قابل اتصال نبود.",
  });
}
