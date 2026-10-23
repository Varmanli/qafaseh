import { invalidatePublicContent } from "@/lib/cache/public-data";
import { readFormDataBody, RequestError } from "@/lib/api/request";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { parseImportFile } from "@/lib/books/import/file";
import { importNormalizedBooks } from "@/lib/books/import/importer";
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
    console.info("admin import commit received", {
      payloadShape: "multipart/form-data",
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    const books = await parseImportFile(file);
    const receivedEditions = books.reduce((sum, book) => sum + book.editions.length, 0);
    const preview = await buildImportPreview(books);
    const validationErrors = preview.books.flatMap((book) => {
      const bookErrors = book.errors.map((message) => ({
        rowNumbers: book.rowNumbers,
        scope: "book",
        message,
      }));
      const editionErrors = book.editions.flatMap((edition) =>
        edition.errors.map((message) => ({
          rowNumbers: [edition.rowNumber],
          scope: "edition",
          message,
        })),
      );
      return [...bookErrors, ...editionErrors];
    });

    console.info("admin import commit parsed", {
      receivedBooks: books.length,
      receivedEditions,
      validBooks: preview.validCount,
      validEditions: preview.summary.readyEditions,
      attemptedBookInserts: preview.books.filter((book) => book.errors.length === 0).length,
      attemptedEditionInserts: preview.books.reduce(
        (sum, book) =>
          sum +
          book.editions.filter(
            (edition) => edition.isValid && edition.duplicateState !== "existing_edition",
          ).length,
        0,
      ),
      validationErrorCount: validationErrors.length,
      validationErrors,
    });

    if (preview.validCount <= 0) {
      return apiError("کتاب معتبری برای ورود وجود ندارد", 422, "IMPORT_NO_VALID_BOOKS");
    }
    const result = await importNormalizedBooks(books, gate.user.id, preview);
    // Import commits per book, so even a later partial failure can change public data.
    invalidatePublicContent();

    console.info("admin import commit result", {
      receivedBooks: result.receivedBooks,
      receivedEditions: result.receivedEditions,
      validBooks: result.validBooks,
      validEditions: result.validEditions,
      attemptedBookInserts: result.validBooks,
      attemptedEditionInserts: result.validEditions,
      createdBooks: result.createdBooks,
      updatedBooks: result.updatedBooks,
      createdEditions: result.createdEditions,
      updatedEditions: result.updatedEditions,
      skippedBooks: result.skippedBooks,
      skippedEditions: result.skippedEditions,
      skippedCount: result.skippedCount,
      failedBooks: result.failedBooks,
      failedEditions: result.failedEditions,
      skippedDuplicateEditions: result.skippedDuplicateEditions,
      validationErrorCount: validationErrors.length,
      transactionErrors: result.transactionErrors,
    });

    if (result.transactionErrors.length > 0 || (result.importedCount === 0 && result.validBooks > 0)) {
      return Response.json(
        {
          ok: false,
          error: "واردسازی در مرحله‌ی ثبت دیتابیس ناموفق بود.",
          code: "IMPORT_COMMIT_FAILED",
          details: result,
        },
        { status: 500 },
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/books");
    return apiSuccess({
      ...result,
      message: `${result.importedCount.toLocaleString("fa-IR")} کتاب و ${result.createdEditions.toLocaleString("fa-IR")} نسخه با موفقیت وارد شد.`,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNSUPPORTED_IMPORT_FILE") {
        return apiError("فرمت فایل باید JSON، XLSX یا XLS باشد", 415, "UNSUPPORTED_IMPORT_FILE");
      }
      if (error.message === "JSON_IMPORT_ARRAY_REQUIRED") {
        return apiError("ریشه‌ی فایل JSON باید یک آرایه از کتاب‌ها باشد", 422, "JSON_IMPORT_ARRAY_REQUIRED");
      }
    }
    console.error("admin import failed:", error);
    return apiError(
      error instanceof Error ? `واردسازی فایل ناموفق بود: ${error.message}` : "واردسازی فایل ناموفق بود",
      500,
    );
  }
}
