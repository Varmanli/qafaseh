import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { getAdminRelatedOptions, listAdminReadingLists, ReadingListError, saveReadingList } from "@/lib/admin/reading-lists";
import { readingListInputSchema } from "@/lib/validations/reading-lists";

const querySchema = z.object({
  q: z.string().max(200).optional(),
  mode: z.enum(["ORDERED", "UNORDERED"]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  category: z.string().max(100).optional(),
});

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return apiError("فیلتر نامعتبر است", 422);
  const [lists, relatedOptions] = await Promise.all([
    listAdminReadingLists(parsed.data), getAdminRelatedOptions(),
  ]);
  return apiSuccess({ lists, relatedOptions });
}

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = readingListInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  try {
    const list = await saveReadingList(parsed.data);
    return apiSuccess({ ...list, message: "لیست ساخته شد" }, { status: 201 });
  } catch (error) {
    if (error instanceof ReadingListError) return apiError(error.message, error.code === "NOT_FOUND" ? 404 : 422);
    if ((error as { code?: string }).code === "23505") return apiError("اسلاگ یا کتاب تکراری است", 409);
    throw error;
  }
}
