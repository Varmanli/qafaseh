import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  adminAddFeaturedBook,
  adminListFeaturedBooks,
} from "@/lib/home/service";

const addSchema = z.object({
  catalogBookId: z.string().min(1, "کتاب نامعتبر است"),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  const items = await adminListFeaturedBooks();
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

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const item = await adminAddFeaturedBook(parsed.data.catalogBookId);
    return apiSuccess(
      { item, message: "به پیشنهادها افزوده شد" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "CATALOG_BOOK_NOT_FOUND") {
      return apiError("کتاب پیدا نشد", 404, "CATALOG_BOOK_NOT_FOUND");
    }
    return apiError("افزودن کتاب ناموفق بود", 400);
  }
}

export const POST = withPublicContentInvalidation(handlePOST);
