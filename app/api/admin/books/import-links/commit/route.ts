import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { commitSuccessSchema } from "@/lib/importers/iranketab/commit-contract";
import { IranKetabCommitError } from "@/lib/importers/iranketab/commit";
import { getImportSession } from "@/lib/importers/iranketab/session";
import { commitIranKetabImportSession, IranKetabCommitServiceError } from "@/lib/importers/iranketab/commit-service";

export const runtime = "nodejs";

/** HTTP adapter only; all importer business rules live in commit-service. */
async function handlePOST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const body = (await req.json().catch(() => null)) as { extraction?: unknown; draft?: unknown; sessionId?: string } | null;
  if (!body?.extraction || !body.draft || !body.sessionId)
    return apiError("درخواست ورود معتبر نیست", 400, "INVALID_DRAFT");
  try {
    const { result } = await commitIranKetabImportSession({ sessionId: body.sessionId, adminId: gate.user.id });
    const payload = commitSuccessSchema.parse({ ok: true, result, sessionId: body.sessionId, sessionStatus: "SUCCESS", urls: { admin: `/admin/books/${result.catalog.id}/edit`, public: `/book/${result.catalog.id}`, history: `/admin/books/import-history/${body.sessionId}` } });
    const { ok: _ok, ...data } = payload;
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof IranKetabCommitServiceError)
      return apiError(error.message, 409, error.code);
    if (error instanceof IranKetabCommitError && error.code === "IMPORT_ALREADY_COMPLETED") {
      const session = (await getImportSession(body.sessionId))?.session;
      if (session?.status === "SUCCESS" && session.catalogId) {
        const summary = (session.resultSummary ?? {}) as { catalogAction?: "CREATED" | "REUSED" | "UPDATED"; catalogTitle?: string; warnings?: string[] };
        const payload = commitSuccessSchema.parse({ ok: true, alreadyCompleted: true, sessionId: body.sessionId, sessionStatus: "SUCCESS", result: { catalog: { id: session.catalogId, title: summary.catalogTitle ?? "کتاب ثبت‌شده", action: summary.catalogAction ?? "REUSED" }, editions: [], entities: { created: [], reused: [] }, warnings: summary.warnings ?? [] }, urls: { admin: `/admin/books/${session.catalogId}/edit`, public: `/book/${session.catalogId}`, history: `/admin/books/import-history/${body.sessionId}` } });
        const { ok: _ok, ...data } = payload;
        return apiSuccess(data);
      }
    }
    const code = error instanceof IranKetabCommitError ? error.code : "IMPORT_FAILED";
    const message = error instanceof IranKetabCommitError ? error.message : "ثبت نهایی کتاب ناموفق بود";
    return NextResponse.json({ ok: false, error: message, code }, { status: error instanceof IranKetabCommitError ? 409 : 500 });
  }
}

export const POST = withPublicContentInvalidation(handlePOST);
