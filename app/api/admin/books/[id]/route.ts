import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { apiValidationError } from "@/lib/api/validation";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  adminDeleteCatalogBook,
  getAdminCatalogBookForEdit,
  setCatalogBookStatus,
  updateAdminCatalogBook,
} from "@/lib/admin/service";
import { catalogStatusSchema } from "@/lib/validations/admin";
import { ADMIN_BOOK_FIELD_LABELS } from "@/lib/validations/catalog-limits";
import { adminBookUpdateWithLinksSchema } from "@/lib/validations/catalog";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  const book = await getAdminCatalogBookForEdit(id);
  if (!book) return apiError("کتاب یافت نشد", 404, "NOT_FOUND");
  return apiSuccess({ book });
}

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = adminBookUpdateWithLinksSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error, ADMIN_BOOK_FIELD_LABELS, body);
  }

  try {
    const { externalLinks, ...bookInput } = parsed.data;
    const result = await updateAdminCatalogBook(id, bookInput, externalLinks);
    return apiSuccess({
      id: result.id,
      slug: result.slug,
      message: "تغییرات کتاب ذخیره شد",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "CATALOG_BOOK_NOT_FOUND") {
      return apiError("کتاب یافت نشد", 404, "NOT_FOUND");
    }
    console.error("admin book update failed:", err);
    return apiError("ذخیره‌ی تغییرات ناموفق بود", 500);
  }
}

async function handlePUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = catalogStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  await setCatalogBookStatus(id, parsed.data.status);
  return apiSuccess({
    message: parsed.data.status === "APPROVED" ? "تأیید شد" : "رد شد",
  });
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  await adminDeleteCatalogBook(id);
  return apiSuccess({ message: "کتاب کاتالوگ حذف شد" });
}

export const PATCH = withPublicContentInvalidation(handlePATCH);

export const PUT = withPublicContentInvalidation(handlePUT);

export const DELETE = withPublicContentInvalidation(handleDELETE);
