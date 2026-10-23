import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  blogCategoryExists,
  createBlogPost,
  listAdminBlogPosts,
} from "@/lib/blog/service";
import {
  adminBlogListQuerySchema,
  blogPostInputSchema,
} from "@/lib/validations/blog";

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const parsed = adminBlogListQuerySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("پارامترهای جست‌وجو نامعتبر است", 422);
  }

  const { page, q, status } = parsed.data;
  const { posts, total } = await listAdminBlogPosts({
    q,
    status: status === "ALL" ? undefined : status,
    offset: (page - 1) * 12,
    limit: 12,
  });

  return apiSuccess({
    posts,
    total,
    page,
    pageSize: 12,
    totalPages: Math.max(1, Math.ceil(total / 12)),
  });
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

  const parsed = blogPostInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  if (!(await blogCategoryExists(parsed.data.categoryId))) {
    return apiError("دسته‌بندی انتخاب‌شده معتبر نیست", 422);
  }

  let created;
  try {
    created = await createBlogPost(parsed.data, gate.user.id);
  } catch (error) {
    if (error instanceof Error && error.message === "BLOG_CATEGORY_NOT_FOUND") {
      return apiError("دسته‌بندی انتخاب‌شده معتبر نیست", 422);
    }
    if (error instanceof Error && error.message === "BLOG_RELATION_NOT_FOUND") {
      return apiError("یکی از ارتباط‌های انتخاب‌شده دیگر معتبر نیست", 422);
    }
    throw error;
  }
  return apiSuccess(
    { id: created.id, slug: created.slug, message: "نوشته با موفقیت ثبت شد" },
    { status: 201 },
  );
}

export const POST = withPublicContentInvalidation(handlePOST);
