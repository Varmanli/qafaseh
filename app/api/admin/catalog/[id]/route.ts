import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { setCatalogStatus, updateCatalogMetadata } from "@/lib/admin/service";

const actionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  metadata: z
    .object({
      title: z.string().min(1).optional(),
      author: z.string().min(1).optional(),
      genre: z.string().min(1).optional(),
      description: z.string().optional(),
    })
    .optional(),
});

// تأیید/رد یک کتاب کاتالوگ (و در صورت نیاز ویرایش متادیتا پیش از تأیید)
async function handlePOST(
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

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    if (parsed.data.metadata) {
      await updateCatalogMetadata(id, parsed.data.metadata);
    }
    await setCatalogStatus(id, parsed.data.status);
    return apiSuccess({
      message:
        parsed.data.status === "APPROVED" ? "کتاب تأیید شد" : "کتاب رد شد",
    });
  } catch (err) {
    console.error("❌ admin catalog action error:", err);
    return apiError("خطا در انجام عملیات", 500);
  }
}

export const POST = withPublicContentInvalidation(handlePOST);
