import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  deleteReadingListCategory,
  ReadingListCategoryError,
  updateReadingListCategory,
} from "@/lib/admin/reading-list-categories";
import { readingListCategoryInputSchema } from "@/lib/validations/reading-list-categories";

const idSchema = z.string().uuid();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("شناسه نامعتبر است", 422);
  const parsed = readingListCategoryInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  try {
    const category = await updateReadingListCategory(id, parsed.data);
    return apiSuccess({ category, message: "دسته‌بندی و فهرست‌های مرتبط به‌روزرسانی شدند" });
  } catch (error) {
    if (error instanceof ReadingListCategoryError) return apiError(error.message, 404);
    if ((error as { code?: string }).code === "23505") return apiError("این دسته‌بندی از قبل وجود دارد", 409);
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("شناسه نامعتبر است", 422);
  try {
    await deleteReadingListCategory(id);
    return apiSuccess({ message: "دسته‌بندی حذف شد" });
  } catch (error) {
    if (error instanceof ReadingListCategoryError) {
      return apiError(error.message, error.code === "NOT_FOUND" ? 404 : 409);
    }
    throw error;
  }
}
