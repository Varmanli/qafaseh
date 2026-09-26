import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { createReadingListDisplayGroup, listReadingListDisplayGroups } from "@/lib/admin/reading-list-display-groups";
import { readingListDisplayGroupInputSchema } from "@/lib/validations/reading-list-display-groups";

export async function GET() {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  return apiSuccess({ groups: await listReadingListDisplayGroups() });
}

export async function POST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = readingListDisplayGroupInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  try {
    const group = await createReadingListDisplayGroup(parsed.data);
    return apiSuccess({ group, message: "گروه نمایش ساخته شد" }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return apiError("این گروه نمایش از قبل وجود دارد", 409);
    throw error;
  }
}
