import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  blogCategoryExists,
  deleteBlogPost,
  getAdminBlogPostById,
  updateBlogPost,
} from "@/lib/blog/service";
import { blogPostInputSchema } from "@/lib/validations/blog";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  const post = await getAdminBlogPostById(id);
  if (!post) return apiError("نوشته پیدا نشد", 404);

  return apiSuccess({ post });
}

async function handlePUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = blogPostInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  if (!(await blogCategoryExists(parsed.data.categoryId))) {
    return apiError("دسته‌بندی انتخاب‌شده معتبر نیست", 422);
  }

  const { id } = await params;
  const existing = await getAdminBlogPostById(id);
  if (!existing) return apiError("نوشته پیدا نشد", 404);

  let updated;
  try {
    updated = await updateBlogPost(id, parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "BLOG_CATEGORY_NOT_FOUND") {
      return apiError("دسته‌بندی انتخاب‌شده معتبر نیست", 422);
    }
    if (error instanceof Error && error.message === "BLOG_RELATION_NOT_FOUND") {
      return apiError("یکی از ارتباط‌های انتخاب‌شده دیگر معتبر نیست", 422);
    }
    throw error;
  }
  return apiSuccess({
    id: updated.id,
    slug: updated.slug,
    message: "نوشته به‌روزرسانی شد",
  });
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  const existing = await getAdminBlogPostById(id);
  if (!existing) return apiError("نوشته پیدا نشد", 404);

  await deleteBlogPost(id);
  return apiSuccess({ message: "نوشته حذف شد" });
}

export const PUT = withPublicContentInvalidation(handlePUT);

export const DELETE = withPublicContentInvalidation(handleDELETE);
