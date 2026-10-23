import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  getAdminStaticPageBySlug,
  updateStaticPage,
} from "@/lib/static-pages/service";
import { staticPageUpdateSchema } from "@/lib/validations/static-pages";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { slug } = await params;
  const page = await getAdminStaticPageBySlug(decodeURIComponent(slug));
  if (!page) return apiError("صفحه پیدا نشد", 404);

  return apiSuccess({ page });
}

async function handlePUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = staticPageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  // اسلاگ از مسیر می‌آید و هرگز تغییر نمی‌کند؛ بدنه نمی‌تواند آن را عوض کند.
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug);

  const updated = await updateStaticPage(normalizedSlug, parsed.data);
  if (!updated) return apiError("صفحه پیدا نشد", 404);

  // صفحه‌ی عمومی و فوتر را تازه می‌کند تا تغییرات بلافاصله دیده شوند.
  revalidatePath(`/${normalizedSlug}`);

  return apiSuccess({ page: updated, message: "صفحه با موفقیت ذخیره شد" });
}

export const PUT = withPublicContentInvalidation(handlePUT);
