import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { searchReadingListBooks } from "@/lib/admin/reading-lists";

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length > 200) return apiError("جست‌وجو طولانی است", 422);
  return apiSuccess({ books: await searchReadingListBooks(q) });
}
