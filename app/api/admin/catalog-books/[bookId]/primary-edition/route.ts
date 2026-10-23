import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  compareEditionSets,
  findDuplicateEditionIds,
  validatePrimaryEditionResponse,
} from "@/lib/admin/edition-set-invariants";
import {
  getAdminCatalogBookForEdit,
  listAdminBookEditions,
  setAdminCatalogBookPrimaryEdition,
} from "@/lib/admin/service";
import { adminPrimaryEditionSchema } from "@/lib/validations/catalog";

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { bookId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = adminPrimaryEditionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const result = await setAdminCatalogBookPrimaryEdition(
      bookId,
      parsed.data,
      gate.user.id,
    );
    const [book, editions] = await Promise.all([
      getAdminCatalogBookForEdit(bookId),
      listAdminBookEditions(bookId),
    ]);
    const responseInvariant = compareEditionSets(
      result.editionIdsBefore.map((id) => ({ id })),
      editions,
    );
    const payloadInvariant = validatePrimaryEditionResponse(bookId, {
      catalogBook: book ? { id: book.id } : null,
      primaryEditionId: result.primaryEditionId,
      editions,
    });
    const selectedEditionMissing = !payloadInvariant.primaryExists;
    const previousPrimaryMissing =
      result.previousPrimaryEditionId !== null &&
      result.editionIdsBefore.includes(result.previousPrimaryEditionId) &&
      !editions.some((edition) => edition.id === result.previousPrimaryEditionId);

    if (
      !responseInvariant.ok ||
      !book ||
      !payloadInvariant.ok ||
      selectedEditionMissing ||
      previousPrimaryMissing
    ) {
      console.error("CRITICAL: primary edition response has invalid edition list", {
        catalogBookId: bookId,
        selectedEditionId: parsed.data.editionId,
        previousPrimaryEditionId: result.previousPrimaryEditionId,
        primaryEditionId: result.primaryEditionId,
        editionIdsBefore: result.editionIdsBefore,
        editionIdsAfter: result.editionIdsAfter,
        responseInvariant,
        payloadInvariant,
        duplicateIds: findDuplicateEditionIds(editions),
        selectedEditionMissing,
        previousPrimaryMissing,
      });
      return apiError(
        "فهرست نسخه‌ها بعد از بروزرسانی نسخه اصلی نامعتبر است",
        500,
        "PRIMARY_EDITION_RESPONSE_INVALID",
      );
    }

    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}/edit`);
    revalidatePath("/books");
    if (book?.slug) {
      revalidatePath(`/book/${book.slug}`);
      revalidatePath(`/book/${book.slug}/notes`);
    }

    return apiSuccess({
      success: true,
      catalogBookId: bookId,
      catalogBook: { id: bookId, primaryEditionId: result.primaryEditionId },
      previousPrimaryEditionId: result.previousPrimaryEditionId,
      primaryEditionId: result.primaryEditionId,
      editionIdsBefore: result.editionIdsBefore,
      editionIdsAfter: result.editionIdsAfter,
      editions,
      message: result.primaryEditionId ? "نسخه اصلی کتاب بروزرسانی شد" : "نسخه اصلی کتاب پاک شد",
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CATALOG_BOOK_NOT_FOUND") {
        return apiError("کتاب پیدا نشد", 404, "CATALOG_BOOK_NOT_FOUND");
      }
      if (err.message === "EDITION_NOT_FOUND") {
        return apiError("نسخه پیدا نشد", 404, "EDITION_NOT_FOUND");
      }
      if (err.message === "EDITION_BOOK_MISMATCH") {
        return apiError("نسخه انتخاب‌شده متعلق به این کتاب نیست", 400, "EDITION_BOOK_MISMATCH");
      }
      if (err.message === "PRIMARY_EDITION_MUTATED_EDITIONS") {
        return apiError(
          "بروزرسانی نسخه اصلی باعث تغییر فهرست نسخه‌ها شد",
          500,
          "PRIMARY_EDITION_MUTATED_EDITIONS",
        );
      }
    }

    console.error("admin primary edition update failed:", err);
    return apiError("بروزرسانی نسخه اصلی ناموفق بود", 500);
  }
}

export const PATCH = withPublicContentInvalidation(handlePATCH);
