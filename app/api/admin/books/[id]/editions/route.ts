import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminBookEdition, listAdminBookEditions } from "@/lib/admin/service";
import { adminEditionCreateSchema } from "@/lib/validations/catalog";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  const editions = await listAdminBookEditions(id);
  return apiSuccess({ editions });
}

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const parsed = adminEditionCreateSchema.safeParse({
    ...(typeof body === "object" && body ? body : {}),
    catalogBookId: id,
  });

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const result = await createAdminBookEdition(id, parsed.data, gate.user.id);
    return apiSuccess(
      { id: result.id, message: "نسخه‌ی جدید ثبت شد" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CATALOG_BOOK_NOT_FOUND") {
        return apiError("کتاب یافت نشد", 404, "NOT_FOUND");
      }
      if (err.message === "DUPLICATE_ISBN10") {
        return apiError("این شابک ۱۰ قبلاً برای نسخه‌ی دیگری ثبت شده است", 409, "DUPLICATE_ISBN10");
      }
      if (err.message === "DUPLICATE_ISBN13") {
        return apiError("این شابک ۱۳ قبلاً برای نسخه‌ی دیگری ثبت شده است", 409, "DUPLICATE_ISBN13");
      }
      if (err.message === "EDITION_NOT_DISTINGUISHED") {
        return apiError("برای ثبت نسخه باید حداقل یک مشخصه‌ی متمایزکننده وارد شود", 422, "EDITION_NOT_DISTINGUISHED");
      }
    }
    console.error("admin edition create failed:", err);
    return apiError("ثبت نسخه ناموفق بود", 500);
  }
}

export const POST = withPublicContentInvalidation(handlePOST);
