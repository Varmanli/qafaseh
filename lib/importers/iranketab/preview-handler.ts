import { NextRequest, NextResponse } from "next/server";
import {
  extractIranKetabBook,
  IranKetabExtractionError,
} from "@ghafaseh/iranketab-extractor";
import { buildAdminIranKetabPreview } from "./preview";
import { acquireIranKetabPreviewSlot } from "./rate-limit";
import {
  fetchIranKetabHtmlSecurely,
  SecureIranKetabFetchError,
  validateIranKetabBookUrl,
} from "./secure-fetch";
import { analyzeIranKetabExtraction } from "./match-analysis";
import type { AnalysisData } from "./match-analysis";
import { assertExtractionCollectionLimits } from "./collection-limits";
import { canonicalIranKetabSourceIdentity } from "./server-hardening";
import type { AcquirePreviewOperationResult, IranKetabPreviewPayload } from "./preview-operation";

type Gate = { user: { id: string } } | { error: NextResponse };
type Dependencies = {
  authorize: () => Promise<Gate>;
  secureFetch?: typeof fetchIranKetabHtmlSecurely;
  enrichProfiles?: boolean;
  acquirePreviewOperation?: (sourceIdentity: string) => Promise<AcquirePreviewOperationResult>;
  completePreviewOperation?: (operationId: string, generation: number, payload: IranKetabPreviewPayload) => Promise<unknown>;
  failPreviewOperation?: (operationId: string, generation: number, input: { code: string; message: string; retryable: boolean }) => Promise<unknown>;
  loadAnalysisData: (
    extraction: Awaited<ReturnType<typeof extractIranKetabBook>>,
  ) => Promise<AnalysisData>;
  startSession?: (input: {
    adminId: string;
    sourceUrl: string;
    canonicalUrl: string;
  }) => Promise<string>;
  sessionStarted?: (input: {
    sessionId: string;
    adminId: string;
  }) => Promise<void>;
  previewReady?: (input: {
    sessionId: string;
    adminId: string;
    extraction: unknown;
    analysis: unknown;
    preview: unknown;
  }) => Promise<void>;
  sessionFailed?: (input: {
    sessionId: string;
    adminId: string;
    error: unknown;
  }) => Promise<void>;
};

export function createIranKetabPreviewPost(dependencies: Dependencies) {
  return async function POST(req: NextRequest) {
    const gate = await dependencies.authorize();
    if ("error" in gate) return gate.error;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return failure(
        "INVALID_REQUEST",
        "درخواست ارسالی معتبر نیست.",
        false,
        400,
      );
    }
    const url =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { url?: unknown }).url === "string"
        ? (body as { url: string }).url
        : "";
    if (!url || url.length > 2048)
      return failure("INVALID_URL", "لینک واردشده معتبر نیست.", false, 400);
    let canonicalUrl: string;
    try {
      canonicalUrl = validateIranKetabBookUrl(url).toString();
    } catch (error) {
      return mappedFailure(error);
    }
    const operations = dependencies.acquirePreviewOperation ? null : await import("./preview-operation");
    const operation = await (dependencies.acquirePreviewOperation ?? operations!.acquireOrGetIranKetabPreview)(canonicalIranKetabSourceIdentity(canonicalUrl));
    if (operation.kind === "PROCESSING") return operationResponse(operation, "IRANKETAB_IMPORT_IN_PROGRESS", "این کتاب هم‌اکنون در حال دریافت است.", 202);
    if (operation.kind === "FAILED") return operationResponse(operation, operation.operation.errorCode ?? "PREVIEW_FAILED", operation.operation.errorMessage ?? "استخراج اطلاعات این صفحه ناموفق بود.", 422);
    const slot = operation.kind === "COMPLETED" ? null : acquireIranKetabPreviewSlot(gate.user.id, canonicalUrl);
    if (slot && !("release" in slot))
      return failure(slot.code, slot.message, true, 429);
    let sessionId: string | undefined;
    try {
      if (operation.kind === "COMPLETED") {
        sessionId = await dependencies.startSession?.({ adminId: gate.user.id, sourceUrl: url, canonicalUrl });
        if (sessionId) await dependencies.sessionStarted?.({ sessionId, adminId: gate.user.id });
        if (sessionId) await dependencies.previewReady?.({ sessionId, adminId: gate.user.id, ...operation.payload });
        return NextResponse.json({ success: true, reused: true, operationId: operation.operation.id, sessionId, ...operation.payload });
      }
      sessionId = await dependencies.startSession?.({
        adminId: gate.user.id,
        sourceUrl: url,
        canonicalUrl,
      });
      if (sessionId)
        await dependencies.sessionStarted?.({
          sessionId,
          adminId: gate.user.id,
        });
      const fetched = await (
        dependencies.secureFetch ?? fetchIranKetabHtmlSecurely
      )(canonicalUrl);
      if (
        canonicalIranKetabSourceIdentity(fetched.canonicalUrl) !==
        canonicalIranKetabSourceIdentity(canonicalUrl)
      ) {
        throw new SecureIranKetabFetchError(
          "REDIRECT_REJECTED",
          "تغییر مسیر به صفحه کتاب دیگری رد شد.",
          false,
        );
      }
      const extraction = await extractIranKetabBook({
        url: fetched.canonicalUrl,
        html: fetched.html,
        enrichProfiles: dependencies.enrichProfiles ?? true,
      });
      assertExtractionCollectionLimits(extraction);
      const data = await dependencies.loadAnalysisData(extraction);
      const analysis = analyzeIranKetabExtraction(extraction, data);
      const preview = buildAdminIranKetabPreview(extraction);
      await (dependencies.completePreviewOperation ?? operations!.completeIranKetabPreview)(operation.operation.id, operation.operation.generation, { extraction, analysis, preview });
      if (sessionId)
        await dependencies.previewReady?.({
          sessionId,
          adminId: gate.user.id,
          extraction,
          analysis,
          preview,
        });
      return NextResponse.json({
        success: true,
        sessionId,
        extraction,
        preview,
        analysis,
      });
    } catch (error) {
      if (!(error instanceof SecureIranKetabFetchError) && !(error instanceof IranKetabExtractionError)) {
        console.error("[iranketab-preview] unexpected failure", {
          sourceUrl: canonicalUrl,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : "unknown",
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      if (sessionId)
        await dependencies
          .sessionFailed?.({ sessionId, adminId: gate.user.id, error })
          .catch(() => undefined);
      const response = mappedFailure(error);
      const payload = await response.clone().json().catch(() => null) as { error?: { code?: string; message?: string; retryable?: boolean } } | null;
      await (dependencies.failPreviewOperation ?? operations!.failIranKetabPreview)(operation.operation.id, operation.operation.generation, { code: payload?.error?.code ?? "PREVIEW_FAILED", message: payload?.error?.message ?? "استخراج اطلاعات این صفحه ناموفق بود.", retryable: payload?.error?.retryable ?? true }).catch(() => undefined);
      return response;
    } finally {
      if (slot && "release" in slot) slot.release();
    }
  };
}

function operationResponse(operation: Extract<AcquirePreviewOperationResult, { kind: "PROCESSING" | "FAILED" }>, code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message, retryable: operation.kind === "PROCESSING" }, operationId: operation.operation.id, operationStatus: operation.operation.status, ...(operation.kind === "PROCESSING" ? { retryAfter: operation.retryAfterSeconds } : {}) }, { status, headers: operation.kind === "PROCESSING" ? { "Retry-After": String(operation.retryAfterSeconds) } : undefined });
}

function mappedFailure(error: unknown): NextResponse {
  if (error instanceof SecureIranKetabFetchError)
    return failure(
      error.code,
      error.message,
      error.retryable,
      statusFor(error.code),
    );
  if (error instanceof IranKetabExtractionError) {
    const messages: Partial<Record<string, string>> = {
      INVALID_URL: "لینک واردشده معتبر نیست.",
      UNSUPPORTED_HOST: "فقط لینک صفحات کتاب سایت ایران‌کتاب قابل پذیرش است.",
      BOOK_TITLE_MISSING: "اطلاعات ضروری کتاب از این صفحه استخراج نشد.",
      PAGE_STRUCTURE_UNRECOGNIZED:
        "ساختار این صفحه قابل شناسایی نیست و ممکن است ایران‌کتاب قالب صفحه را تغییر داده باشد.",
      PARSE_FAILED: "استخراج اطلاعات این صفحه ناموفق بود.",
    };
    return failure(
      error.code,
      messages[error.code] ?? "استخراج اطلاعات این صفحه ناموفق بود.",
      error.retryable,
      422,
    );
  }
  if (error instanceof Error && error.message.includes("حداکثر مجاز"))
    return failure("COLLECTION_LIMIT_EXCEEDED", error.message, false, 422);
  return failure(
    "PREVIEW_FAILED",
    "ساخت پیش‌نمایش ناموفق بود. دوباره تلاش کنید.",
    true,
    500,
  );
}
function statusFor(code: string): number {
  if (
    [
      "INVALID_URL",
      "UNSUPPORTED_HOST",
      "UNSUPPORTED_PATH",
      "UNSAFE_DESTINATION",
      "REDIRECT_REJECTED",
      "TOO_MANY_REDIRECTS",
    ].includes(code)
  )
    return 400;
  if (
    ["INVALID_CONTENT_TYPE", "RESPONSE_TOO_LARGE", "INVALID_HTML"].includes(
      code,
    )
  )
    return 422;
  if (code === "HTTP_ERROR") return 502;
  if (code === "FETCH_TIMEOUT") return 504;
  return 502;
}
function failure(
  code: string,
  message: string,
  retryable: boolean,
  status: number,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, retryable } },
    { status },
  );
}
