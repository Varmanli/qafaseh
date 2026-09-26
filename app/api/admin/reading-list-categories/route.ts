import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { createReadingListCategory, listReadingListCategories } from "@/lib/admin/reading-list-categories";
import { readingListCategoryInputSchema } from "@/lib/validations/reading-list-categories";

export async function GET() {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  return apiSuccess({ categories: await listReadingListCategories() });
}

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = readingListCategoryInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  try {
    const category = await createReadingListCategory(parsed.data);
    return apiSuccess({ category, message: "دسته‌بندی ساخته شد" }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return apiError("این دسته‌بندی از قبل وجود دارد", 409);
    throw error;
  }
}
