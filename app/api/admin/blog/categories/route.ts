import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { createBlogCategory, listBlogCategories } from "@/lib/blog/service";
import { blogCategoryInputSchema } from "@/lib/validations/blog";

export async function GET() {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const categories = await listBlogCategories();
  return apiSuccess({ categories });
}

async function handlePOST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = blogCategoryInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  const created = await createBlogCategory(parsed.data);
  return apiSuccess(
    { id: created.id, slug: created.slug, message: "دسته‌بندی ساخته شد" },
    { status: 201 },
  );
}

export const POST = withPublicContentInvalidation(handlePOST);
