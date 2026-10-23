import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { deleteAdminBookEdition, updateAdminBookEdition } from "@/lib/admin/service";
import { adminEditionUpdateSchema } from "@/lib/validations/catalog";

async function handlePATCH(
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

  const parsed = adminEditionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const result = await updateAdminBookEdition(id, parsed.data);
    return apiSuccess({
      id: result.id,
      catalogBookId: result.catalogBookId,
      message: "نسخه بروزرسانی شد",
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "EDITION_NOT_FOUND") {
        return apiError("نسخه یافت نشد", 404, "NOT_FOUND");
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
    console.error("admin edition update failed:", err);
    return apiError("بروزرسانی نسخه ناموفق بود", 500);
  }
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;

  try {
    const result = await deleteAdminBookEdition(id);
    return apiSuccess({
      catalogBookId: result.catalogBookId,
      message: "نسخه حذف شد",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EDITION_NOT_FOUND") {
      return apiError("نسخه یافت نشد", 404, "NOT_FOUND");
    }
    console.error("admin edition delete failed:", err);
    return apiError("حذف نسخه ناموفق بود", 500);
  }
}

export const PATCH = withPublicContentInvalidation(handlePATCH);

export const DELETE = withPublicContentInvalidation(handleDELETE);
