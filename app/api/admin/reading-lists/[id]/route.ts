import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { deleteReadingList, getAdminReadingList, getAdminRelatedOptions, ReadingListError, saveReadingList, setReadingListStatus } from "@/lib/admin/reading-lists";
import { readingListInputSchema } from "@/lib/validations/reading-lists";

type Context = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function GET(_req: NextRequest, { params }: Context) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("شناسه نامعتبر است", 422);
  const list = await getAdminReadingList(id);
  if (!list) return apiError("لیست پیدا نشد", 404);
  return apiSuccess({ list, relatedOptions: await getAdminRelatedOptions(id) });
}

export async function PUT(req: NextRequest, { params }: Context) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("شناسه نامعتبر است", 422);
  const parsed = readingListInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  try {
    const list = await saveReadingList(parsed.data, id);
    return apiSuccess({ ...list, message: "لیست ذخیره شد" });
  } catch (error) {
    if (error instanceof ReadingListError) return apiError(error.message, error.code === "NOT_FOUND" ? 404 : 422);
    if ((error as { code?: string }).code === "23505") return apiError("اسلاگ یا کتاب تکراری است", 409);
    throw error;
  }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("شناسه نامعتبر است", 422);
  const parsed = z.object({ status: z.enum(["DRAFT", "PUBLISHED"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("وضعیت نامعتبر است", 422);
  try {
    await setReadingListStatus(id, parsed.data.status);
    return apiSuccess({ message: "وضعیت ذخیره شد" });
  } catch (error) {
    if (error instanceof ReadingListError) return apiError(error.message, error.code === "NOT_FOUND" ? 404 : 422);
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("شناسه نامعتبر است", 422);
  try {
    await deleteReadingList(id);
    return apiSuccess({ message: "لیست حذف شد" });
  } catch (error) {
    if (error instanceof ReadingListError) return apiError(error.message, 404);
    throw error;
  }
}
