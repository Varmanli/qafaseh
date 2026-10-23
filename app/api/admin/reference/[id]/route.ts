import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { updateReferenceSchema } from "@/lib/validations/reference";
import {
  adminDeleteReference,
  adminUpdateReference,
} from "@/lib/reference/service";

async function handlePUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = updateReferenceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  await adminUpdateReference(id, parsed.data);
  return apiSuccess({ message: "به‌روزرسانی شد" });
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  const { id } = await params;
  await adminDeleteReference(id);
  return apiSuccess({ message: "حذف شد" });
}

export const PUT = withPublicContentInvalidation(handlePUT);

export const DELETE = withPublicContentInvalidation(handleDELETE);
