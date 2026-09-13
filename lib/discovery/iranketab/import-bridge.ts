import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

import { databaseDiagnosticTarget, db } from "@/db";
import { IranKetabDiscoveryItem } from "@/db/schema";
import { loadIranKetabAnalysisData } from "@/lib/importers/iranketab/match-repository";
import { createIranKetabPreviewPost } from "@/lib/importers/iranketab/preview-handler";
import {
  classifyRetryable,
  createImportSession,
  extractionFingerprint,
  getImportSession,
  markExtractionStarted,
  transitionImportSession,
} from "@/lib/importers/iranketab/session";
import { validateIranKetabBookUrl } from "@/lib/importers/iranketab/secure-fetch";

export class IranKetabDiscoveryImportBridgeError extends Error {
  constructor(
    public readonly code:
      | "DISCOVERY_ITEM_NOT_FOUND"
      | "DISCOVERY_ITEM_NOT_QUEUED"
      | "DISCOVERY_ITEM_INVALID_URL"
      | "DISCOVERY_IMPORT_ALREADY_RUNNING"
      | "IMPORT_PREPARATION_FAILED",
    public readonly message: string,
  ) {
    super(message);
  }
}

type PreviewFailure = {
  success?: false;
  error?: { code?: string; message?: string; retryable?: boolean };
};

/**
 * Hands an approved discovery candidate to the existing synchronous importer
 * preview flow. It deliberately stops at PREVIEW_READY: commit remains an
 * explicit action in the established importer UI.
 */
export async function startDiscoveryImport(discoveryItemId: string, actorId: string) {
  const itemId = discoveryItemId;
  const adminId = actorId;
  bridgeLog("candidate_lookup_started", { discoveryItemId: itemId, actorId: adminId, databaseTarget: databaseDiagnosticTarget() });
  const [item] = await db
    .select()
    .from(IranKetabDiscoveryItem)
    .where(eq(IranKetabDiscoveryItem.id, itemId))
    .limit(1);
  if (!item) {
    bridgeLog("candidate_lookup_missing", { discoveryItemId: itemId, actorId: adminId });
    throw new IranKetabDiscoveryImportBridgeError(
      "DISCOVERY_ITEM_NOT_FOUND",
      "نامزد کشف یافت نشد.",
    );
  }

  bridgeLog("candidate_lookup_succeeded", {
    discoveryItemId: item.id,
    status: item.status,
    importSessionId: item.importSessionId,
  });

  if (item.importSessionId && item.status === "IMPORTING") {
    const existing = await getImportSession(item.importSessionId);
    if (existing?.session.status === "PREVIEW_READY") {
      await markDiscoveryItemPreviewReady(item.id, existing.session.id);
      return { session: existing.session, reused: true };
    }
    if (existing?.session.status === "FAILED") {
      const message = existing.session.errorMessage ?? "آماده‌سازی ورود ناموفق بود.";
      await markDiscoveryItemFailed(item.id, existing.session.errorCode ?? "IMPORT_PREPARATION_FAILED", message, existing.session.id);
      throw new IranKetabDiscoveryImportBridgeError("IMPORT_PREPARATION_FAILED", message);
    }
    if (existing) return { session: existing.session, reused: true };
  }
  if (item.status !== "QUEUED") {
    bridgeLog("candidate_rejected", {
      discoveryItemId: item.id,
      status: item.status,
      reason: "DISCOVERY_ITEM_NOT_QUEUED",
    });
    throw new IranKetabDiscoveryImportBridgeError(
      "DISCOVERY_ITEM_NOT_QUEUED",
      "فقط نامزدهای تأییدشده برای ورود قابل آماده‌سازی هستند.",
    );
  }

  let canonicalUrl: string;
  try {
    canonicalUrl = validateIranKetabBookUrl(item.canonicalUrl).toString();
  } catch {
    await markDiscoveryItemFailed(item.id, "DISCOVERY_ITEM_INVALID_URL", "لینک کتاب ایران‌کتاب معتبر نیست.");
    throw new IranKetabDiscoveryImportBridgeError(
      "DISCOVERY_ITEM_INVALID_URL",
      "لینک کتاب ایران‌کتاب معتبر نیست.",
    );
  }

  let createdSessionId: string | null = null;
  const previewHandler = createIranKetabPreviewPost({
    authorize: async () => ({ user: { id: adminId } }) as never,
    loadAnalysisData: loadIranKetabAnalysisData,
    startSession: async ({ sourceUrl, canonicalUrl: importerCanonicalUrl }) => {
      const session = await createImportSession({
        adminId,
        sourceUrl,
        canonicalSourceUrl: importerCanonicalUrl,
        metadata: {
          discovery: {
            itemId: item.id,
            iranKetabBookId: item.iranKetabBookId,
          },
        },
      });
      createdSessionId = session.id;
      const [linked] = await db
        .update(IranKetabDiscoveryItem)
        .set({
          status: "IMPORTING",
          importSessionId: session.id,
          failureCode: null,
          failureReason: null,
          nextRetryAt: null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(IranKetabDiscoveryItem.id, item.id),
            eq(IranKetabDiscoveryItem.status, "QUEUED"),
          ),
        )
        .returning({ id: IranKetabDiscoveryItem.id });
      if (!linked)
        throw new IranKetabDiscoveryImportBridgeError(
          "DISCOVERY_IMPORT_ALREADY_RUNNING",
          "این نامزد هم‌اکنون در حال آماده‌سازی است.",
        );
      return session.id;
    },
    sessionStarted: async ({ sessionId }) => {
      await markExtractionStarted(sessionId, adminId);
    },
    previewReady: async ({ sessionId, extraction, analysis, preview }) => {
      await transitionImportSession(
        sessionId,
        adminId,
        "PREVIEW_READY",
        {
          extraction: extraction as Record<string, unknown>,
          extractionFingerprint: extractionFingerprint(extraction),
          metadata: {
            discovery: { itemId: item.id, iranKetabBookId: item.iranKetabBookId },
            analysis,
            preview,
          },
        },
        "EXTRACTION_COMPLETED",
      );
      await markDiscoveryItemPreviewReady(item.id, sessionId);
    },
    sessionFailed: async ({ sessionId, error }) => {
      const code = error instanceof Error ? error.message : "PREVIEW_FAILED";
      await transitionImportSession(sessionId, adminId, "FAILED", {
        errorCode: code,
        errorMessage: "استخراج اطلاعات ناموفق بود.",
        retryable: classifyRetryable(code),
        completedAt: new Date(),
      });
    },
  });

  const response = await previewHandler(
    new NextRequest("http://localhost/api/admin/books/import-links/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: canonicalUrl }),
    }),
  );
  const payload = (await response.json().catch(() => null)) as PreviewFailure | null;
  if (!response.ok || payload?.success === false) {
    const code = payload?.error?.code ?? "IMPORT_PREPARATION_FAILED";
    const message = payload?.error?.message ?? "آماده‌سازی ورود کتاب ناموفق بود.";
    if (createdSessionId) await markDiscoveryItemFailed(item.id, code, message, createdSessionId);
    throw new IranKetabDiscoveryImportBridgeError(
      code === "IRANKETAB_IMPORT_IN_PROGRESS" ? "DISCOVERY_IMPORT_ALREADY_RUNNING" : "IMPORT_PREPARATION_FAILED",
      message,
    );
  }

  if (!createdSessionId)
    throw new IranKetabDiscoveryImportBridgeError(
      "IMPORT_PREPARATION_FAILED",
      "نشست ورود ایجاد نشد.",
    );
  const session = await getImportSession(createdSessionId);
  if (!session)
    throw new IranKetabDiscoveryImportBridgeError(
      "IMPORT_PREPARATION_FAILED",
      "نشست ورود پس از آماده‌سازی یافت نشد.",
    );
  return { session: session.session, reused: false };
}

/** @deprecated Use startDiscoveryImport for the explicit bridge lifecycle. */
export const queueDiscoveryItemForImport = startDiscoveryImport;

function bridgeLog(event: string, details: Record<string, unknown>) {
  console.info("[iranketab-discovery-import-bridge]", JSON.stringify({ event, ...details }));
}

async function markDiscoveryItemFailed(
  itemId: string,
  failureCode: string,
  failureReason: string,
  importSessionId?: string,
) {
  await db
    .update(IranKetabDiscoveryItem)
    .set({
      status: "FAILED",
      ...(importSessionId ? { importSessionId } : {}),
      failureCode,
      failureReason,
      retryCount: sql`${IranKetabDiscoveryItem.retryCount} + 1`,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      importSessionId
        ? and(
            eq(IranKetabDiscoveryItem.id, itemId),
            eq(IranKetabDiscoveryItem.importSessionId, importSessionId),
          )
        : and(
            eq(IranKetabDiscoveryItem.id, itemId),
            eq(IranKetabDiscoveryItem.status, "QUEUED"),
          ),
    );
}

/** PREVIEW_READY awaits explicit manual review/commit in the existing importer. */
async function markDiscoveryItemPreviewReady(itemId: string, importSessionId: string) {
  await db
    .update(IranKetabDiscoveryItem)
    .set({
      status: "NEEDS_REVIEW",
      failureCode: null,
      failureReason: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(IranKetabDiscoveryItem.id, itemId),
        eq(IranKetabDiscoveryItem.importSessionId, importSessionId),
        eq(IranKetabDiscoveryItem.status, "IMPORTING"),
      ),
    );
}
