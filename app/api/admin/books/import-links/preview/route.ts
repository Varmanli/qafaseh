import { assertAdminApi } from "@/lib/admin/permissions";
import { createIranKetabPreviewPost } from "@/lib/importers/iranketab/preview-handler";
import { loadIranKetabAnalysisData } from "@/lib/importers/iranketab/match-repository";
import {
  classifyRetryable,
  createImportSession,
  extractionFingerprint,
  markExtractionStarted,
  transitionImportSession,
} from "@/lib/importers/iranketab/session";

export const POST = createIranKetabPreviewPost({
  authorize: assertAdminApi,
  loadAnalysisData: loadIranKetabAnalysisData,
  startSession: async ({ adminId, sourceUrl, canonicalUrl }) =>
    (
      await createImportSession({
        adminId,
        sourceUrl,
        canonicalSourceUrl: canonicalUrl,
      })
    ).id,
  sessionStarted: async ({ sessionId, adminId }) => {
    await markExtractionStarted(sessionId, adminId);
  },
  previewReady: async ({
    sessionId,
    adminId,
    extraction,
    analysis,
    preview,
  }) => {
    await transitionImportSession(
      sessionId,
      adminId,
      "PREVIEW_READY",
      {
        extraction: extraction as Record<string, unknown>,
        extractionFingerprint: extractionFingerprint(extraction),
        metadata: { analysis, preview },
      },
      "EXTRACTION_COMPLETED",
    );
  },
  sessionFailed: async ({ sessionId, adminId, error }) => {
    const code = error instanceof Error ? error.message : "PREVIEW_FAILED";
    await transitionImportSession(sessionId, adminId, "FAILED", {
      errorCode: code,
      errorMessage: "استخراج اطلاعات ناموفق بود.",
      retryable: classifyRetryable(code),
      completedAt: new Date(),
    });
  },
});
