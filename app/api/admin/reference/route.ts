import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  approvalStatusSchema,
  createReferenceSchema,
  referenceTypeSchema,
} from "@/lib/validations/reference";
import { adminCreateReference, adminListReference } from "@/lib/reference/service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  const sp = req.nextUrl.searchParams;
  const type = referenceTypeSchema.safeParse(sp.get("type"));
  const status = approvalStatusSchema.safeParse(sp.get("status"));

  const items = await adminListReference({
    type: type.success ? type.data : undefined,
    status: status.success ? status.data : undefined,
    q: sp.get("q") ?? undefined,
  });
  return apiSuccess({ items });
}

async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = createReferenceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  const item = await adminCreateReference(parsed.data.type, parsed.data.name);
  return apiSuccess({ item, message: "مقدار ثبت شد" }, { status: 201 });
}

export const POST = withPublicContentInvalidation(handlePOST);
