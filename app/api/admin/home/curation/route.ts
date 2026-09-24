import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  FEATURED_AUTHOR_LIMIT,
  FEATURED_BLOG_POST_LIMIT,
  FEATURED_READING_LIST_LIMIT,
  getHomepageCuration,
  saveHomepageCuration,
} from "@/lib/home/curation";

const curationSchema = z.object({
  authorIds: z
    .array(z.string().min(1))
    .max(FEATURED_AUTHOR_LIMIT, "حداکثر ۶ نویسنده مجاز است")
    .refine((ids) => new Set(ids).size === ids.length, "نویسنده تکراری است"),
  postIds: z
    .array(z.string().min(1))
    .max(FEATURED_BLOG_POST_LIMIT, "حداکثر ۳ مطلب مجاز است")
    .refine((ids) => new Set(ids).size === ids.length, "مطلب تکراری است"),
  readingListIds: z
    .array(z.string().min(1))
    .max(FEATURED_READING_LIST_LIMIT, "حداکثر ۲ مسیر مطالعه مجاز است")
    .refine((ids) => new Set(ids).size === ids.length, "مسیر مطالعه تکراری است")
    .default([]),
});

export async function GET() {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  return apiSuccess(await getHomepageCuration());
}

export async function PUT(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = curationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    await saveHomepageCuration(parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "HOMEPAGE_CURATION_RECORD_NOT_FOUND") {
      return apiError("یکی از انتخاب‌ها دیگر برای نمایش عمومی معتبر نیست", 422);
    }
    if (error instanceof Error && error.message === "HOMEPAGE_CURATION_INVALID") {
      return apiError("انتخاب‌های صفحه اصلی نامعتبر است", 422);
    }
    throw error;
  }

  revalidatePath("/");
  return apiSuccess({ message: "تنظیمات صفحه اصلی ذخیره شد" });
}
