import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { apiValidationError } from "@/lib/api/validation";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  adminCreateCatalogBook,
  adminListCatalogBooks,
} from "@/lib/admin/service";
import { ADMIN_BOOK_FIELD_LABELS } from "@/lib/validations/catalog-limits";
import { adminBookCreateSchema } from "@/lib/validations/catalog";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const s = sp.get("status");
  const status =
    s === "PENDING" || s === "APPROVED" || s === "REJECTED" ? s : undefined;

  const { books, total } = await adminListCatalogBooks({
    q: sp.get("q") ?? undefined,
    status,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return apiSuccess({
    books,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
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

  const parsed = adminBookCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error, ADMIN_BOOK_FIELD_LABELS, body);
  }

  const { externalLinks, ...bookInput } = parsed.data;
  const result = await adminCreateCatalogBook(
    bookInput,
    gate.user.id,
    externalLinks,
  );
  return apiSuccess(
    {
      id: result.id,
      slug: result.slug,
      message: "کتاب در کاتالوگ ثبت و تأیید شد",
    },
    { status: 201 }
  );
}

export const POST = withPublicContentInvalidation(handlePOST);
