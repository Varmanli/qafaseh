import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  deleteBlogCategory,
  getBlogCategoryById,
  updateBlogCategory,
} from "@/lib/blog/service";
import { blogCategoryInputSchema } from "@/lib/validations/blog";

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  const existing = await getBlogCategoryById(id);
  if (!existing) return apiError("دسته‌بندی پیدا نشد", 404);

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

  await updateBlogCategory(id, parsed.data);
  return apiSuccess({ message: "ذخیره شد" });
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  const result = await deleteBlogCategory(id);
  if (!result.ok) return apiError(result.reason, 409);

  return apiSuccess({ message: "دسته‌بندی حذف شد" });
}

export const PATCH = withPublicContentInvalidation(handlePATCH);

export const DELETE = withPublicContentInvalidation(handleDELETE);
