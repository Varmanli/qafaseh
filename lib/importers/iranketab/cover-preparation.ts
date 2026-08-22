import { createHash } from "node:crypto";
import type { IranKetabExtractionEnvelope } from "@ghafaseh/iranketab-extractor";
import { saveImageUpload, deleteImageUpload, headImageUpload } from "@/lib/server/upload-storage";
import { iranKetabImportDraftSchema, type IranKetabImportDraft, validateIranKetabDraft } from "./draft";
import { assertExtractionCollectionLimits, formatIranKetabSchemaIssues } from "./collection-limits";
import { fetchIranKetabCoverSecurely, IranKetabCoverFetchError, validateIranKetabCoverUrl } from "./cover-fetch";
import { IranKetabCoverProcessingError, processIranKetabCover } from "./cover-processing";
import type { PreparedCoverResult, PreparedDraft } from "./cover-contract";
import { prepareIranKetabReferenceImage } from "./reference-image-preparation";

/** Server-produced only: Phase 6 must bind this fingerprint and these keys to its final commit. */
export type IranKetabImportDraftWithPreparedCovers = PreparedDraft;
const COVER_PREPARATION_CONCURRENCY = 1;
export function draftFingerprint(draft: IranKetabImportDraft) { return createHash("sha256").update(JSON.stringify({ canonicalUrl: draft.source.canonicalUrl, draftVersion: draft.draftVersion, catalog: draft.catalog.action === "REUSE_EXISTING" ? draft.catalog.catalogId : "new", editions: draft.editions.map(e => e.action === "CREATE_NEW" ? [e.extractedEditionIndex, e.fields.sourceEditionCode, e.coverAction] : [e.extractedEditionIndex, e.action]) })).digest("hex"); }
export function temporaryCoverPrefix(adminId: string, fingerprint: string, sessionId?: string) { return sessionId ? `tmp/iranketab-imports/${adminId}/${sessionId}/${fingerprint}/` : `tmp/iranketab-imports/${adminId}/${fingerprint}/`; }
export function isOwnedTemporaryCoverKey(key: string, adminId: string, fingerprint: string, sessionId?: string) {
  return key.startsWith(temporaryCoverPrefix(adminId, fingerprint, sessionId)) && new RegExp(`^tmp/iranketab-imports/${adminId.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}/${sessionId ? `${sessionId.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}/` : ""}[a-f0-9]{64}/[a-z0-9-]+\\.webp$`, "i").test(key);
}

export async function prepareIranKetabCovers(params: { adminId: string; sessionId: string; extraction: IranKetabExtractionEnvelope; draft: IranKetabImportDraft }): Promise<{ fingerprint: string; results: PreparedCoverResult[]; preparedDraft: IranKetabImportDraftWithPreparedCovers }> {
  assertExtractionCollectionLimits(params.extraction);
  const parsed = iranKetabImportDraftSchema.safeParse(params.draft); if (!parsed.success) throw new Error(formatIranKetabSchemaIssues(parsed.error).join(" ")); if (params.extraction.contractVersion !== params.draft.source.contractVersion || params.extraction.source.canonicalUrl !== params.draft.source.canonicalUrl || params.extraction.source.editionCode !== params.draft.source.selectedEditionCode) throw new Error("INVALID_DRAFT");
  const allowed = new Set(Object.values(params.extraction.diagnostics.coverCandidatesByEdition).flat().map(candidate => candidate.url)); const validation = validateIranKetabDraft(params.draft, allowed); if (!validation.valid) throw new Error("INVALID_DRAFT");
  const fingerprint = draftFingerprint(params.draft); const prefix = temporaryCoverPrefix(params.adminId, fingerprint, params.sessionId); const preparedReferenceImages: NonNullable<PreparedDraft["preparedReferenceImages"]> = [];
  const processedCoverByUrl = new Map<string, Promise<Awaited<ReturnType<typeof downloadAndProcessCover>>>>();
  console.info("[iranketab.media] prepare started", { sessionId: params.sessionId, fingerprint, concurrency: COVER_PREPARATION_CONCURRENCY });
  const results = await mapWithConcurrency(params.draft.editions, COVER_PREPARATION_CONCURRENCY, async (decision): Promise<PreparedCoverResult> => { const source = params.extraction.editions[decision.extractedEditionIndex]; if (!source) throw new Error("INVALID_DRAFT"); if (decision.action === "EXCLUDE" || decision.coverAction.action === "SKIP") return { extractedEditionIndex: decision.extractedEditionIndex, sourceEditionCode: source.sourceEditionCode, status: "SKIPPED" }; if (decision.coverAction.action === "KEEP_EXISTING") return { extractedEditionIndex: decision.extractedEditionIndex, sourceEditionCode: source.sourceEditionCode, status: "KEPT_EXISTING" }; const url = decision.coverAction.candidateUrl; if (!allowed.has(url) || !params.draft.source.approvedCoverCandidateUrls.includes(url) || !params.extraction.diagnostics.coverCandidatesByEdition[source.sourceEditionCode]?.some(candidate => candidate.url === url)) return { extractedEditionIndex: decision.extractedEditionIndex, sourceEditionCode: source.sourceEditionCode, status: "FAILED", error: { code: "INVALID_COVER_PROVENANCE", message: "آدرس کاور با اطلاعات استخراج‌شده مطابقت ندارد.", retryable: false } };
    try { const staged = await stageCover(params, fingerprint, prefix, decision.extractedEditionIndex, source.sourceEditionCode, url, processedCoverByUrl); return staged; } catch (error) { const known = error instanceof IranKetabCoverFetchError || error instanceof IranKetabCoverProcessingError; return { extractedEditionIndex: decision.extractedEditionIndex, sourceEditionCode: source.sourceEditionCode, status: "FAILED", error: { code: known ? error.code : "COVER_UPLOAD_FAILED", message: known ? error.message : "انتقال کاور به فضای ذخیره‌سازی انجام نشد.", retryable: !known || error instanceof IranKetabCoverFetchError && error.retryable } }; }
  });
  for (const [entityIndex, entity] of params.draft.entities.entries()) {
    if ((entity.entityType !== "AUTHOR" && entity.entityType !== "TRANSLATOR" && entity.entityType !== "PUBLISHER") || (entity.action !== "CREATE_NEW" && entity.action !== "REUSE_EXISTING")) continue;
      const imageUrl = entity.profile?.imageUrl;
    if (!imageUrl) continue;
    for (const kind of ["PROFILE", "BANNER"] as const) {
      const action = kind === "PROFILE" ? entity.profileImageAction : entity.bannerImageAction;
      if (action === "preserve" || action === "remove") continue;
      const sourceUrl = kind === "PROFILE" ? imageUrl : entity.profile?.bannerImageUrl;
      if (!sourceUrl) continue;
      try {
        const entityToken = createHash("sha256").update(`${entity.entityType}:${entity.extractedName}:${entityIndex}`).digest("hex").slice(0, 16);
        const image = await prepareIranKetabReferenceImage({ sourceUrl, objectKey: `${prefix}reference-${entity.entityType.toLowerCase()}-${entityToken}-${kind.toLowerCase()}-${crypto.randomUUID()}.webp`, metadata: { "iranketab-admin": params.adminId, "iranketab-session-id": params.sessionId, "iranketab-fingerprint": fingerprint } });
        console.info("[iranketab.media] staged upload", { sessionId: params.sessionId, key: image.objectKey, kind, entityType: entity.entityType, sizeBytes: image.sizeBytes });
        preparedReferenceImages.push({ entityType: entity.entityType, extractedName: entity.extractedName, kind, status: "PREPARED", ...image });
      } catch (error) {
        preparedReferenceImages.push({ entityType: entity.entityType, extractedName: entity.extractedName, kind, status: "FAILED", sourceUrl, error: error instanceof Error ? error.message : "REFERENCE_IMAGE_FAILED" });
      }
    }
  }
  return { fingerprint, results, preparedDraft: { sessionId: params.sessionId, draft: params.draft, fingerprint, preparedCovers: results, preparedReferenceImages } };
}
/** Repair only missing objects. A replacement always receives a new, session-scoped key. */
export async function reprepareMissingIranKetabMedia(params: { adminId: string; sessionId: string; extraction: IranKetabExtractionEnvelope; prepared: IranKetabImportDraftWithPreparedCovers; head?: typeof headImageUpload }) {
  const { draft, fingerprint } = params.prepared;
  const prefix = temporaryCoverPrefix(params.adminId, fingerprint, params.sessionId);
  const head = params.head ?? headImageUpload;
  const preparedCovers = await Promise.all(params.prepared.preparedCovers.map(async item => {
    if (item.status !== "PREPARED") return item;
    const owned = isOwnedTemporaryCoverKey(item.objectKey, params.adminId, fingerprint, params.sessionId);
    const exists = owned ? await head(item.objectKey) : null;
    console.info("[iranketab.media] source HeadObject", { sessionId: params.sessionId, key: item.objectKey, exists: Boolean(exists), owned, kind: "BOOK_COVER" });
    if (exists) return item;
    const replacement = await stageCover(params, fingerprint, prefix, item.extractedEditionIndex, item.sourceEditionCode, item.originalSourceUrl);
    console.warn("[iranketab.media] key replacement after reprepare", { sessionId: params.sessionId, oldKey: item.objectKey, newKey: replacement.objectKey, kind: "BOOK_COVER" });
    return replacement;
  }));
  const preparedReferenceImages = await Promise.all((params.prepared.preparedReferenceImages ?? []).map(async (item, entityIndex) => {
    if (item.status !== "PREPARED" || !item.objectKey) return item;
    const owned = isOwnedTemporaryCoverKey(item.objectKey, params.adminId, fingerprint, params.sessionId);
    const exists = owned ? await head(item.objectKey) : null;
    console.info("[iranketab.media] source HeadObject", { sessionId: params.sessionId, key: item.objectKey, exists: Boolean(exists), owned, kind: item.kind, entityType: item.entityType });
    if (exists) return item;
    const token = createHash("sha256").update(`${item.entityType}:${item.extractedName}:${entityIndex}:${Date.now()}`).digest("hex").slice(0, 16);
    const image = await prepareIranKetabReferenceImage({ sourceUrl: item.sourceUrl, objectKey: `${prefix}reference-${item.entityType.toLowerCase()}-${token}-${item.kind.toLowerCase()}-${crypto.randomUUID()}.webp`, metadata: { "iranketab-admin": params.adminId, "iranketab-session-id": params.sessionId, "iranketab-fingerprint": fingerprint } });
    console.warn("[iranketab.media] key replacement after reprepare", { sessionId: params.sessionId, oldKey: item.objectKey, newKey: image.objectKey, kind: item.kind, entityType: item.entityType });
    return { ...item, ...image, status: "PREPARED" as const };
  }));
  return { ...params.prepared, sessionId: params.sessionId, preparedCovers, preparedReferenceImages } as IranKetabImportDraftWithPreparedCovers;
}
async function downloadAndProcessCover(url: string) { validateIranKetabCoverUrl(url); const downloaded = await fetchIranKetabCoverSecurely(url); return processIranKetabCover(downloaded.buffer, downloaded.mime); }
async function stageCover(params: { adminId: string; sessionId: string }, fingerprint: string, prefix: string, index: number, sourceEditionCode: string, url: string, processedCoverByUrl = new Map<string, Promise<Awaited<ReturnType<typeof downloadAndProcessCover>>>>()): Promise<Extract<PreparedCoverResult, { status: "PREPARED" }>> {
  let processed = processedCoverByUrl.get(url); if (!processed) { processed = downloadAndProcessCover(url); processedCoverByUrl.set(url, processed); } const image = await processed; const objectKey = `${prefix}${index}-${sourceEditionCode.replace(/[^a-z0-9-]/gi, "-")}-${crypto.randomUUID()}.webp`; const upload = await saveImageUpload({ buffer: image.buffer, contentType: image.mimeType, filename: "cover.webp", folder: "temp", objectKey, metadata: { "iranketab-admin": params.adminId, "iranketab-session-id": params.sessionId, "iranketab-fingerprint": fingerprint, "iranketab-edition-index": String(index), "iranketab-edition-code": sourceEditionCode } });
  console.info("[iranketab.media] staged upload", { sessionId: params.sessionId, key: upload.key, kind: "BOOK_COVER", sizeBytes: image.buffer.length, driver: upload.driver });
  return { extractedEditionIndex: index, sourceEditionCode, status: "PREPARED", action: "USE_PREPARED", objectKey: upload.key, url: upload.url, originalSourceUrl: url, mimeType: image.mimeType, width: image.width, height: image.height, sizeBytes: image.buffer.length, preparedAt: new Date().toISOString() };
}
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> { const results = new Array<R>(items.length); let next = 0; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (true) { const index = next++; if (index >= items.length) return; results[index] = await mapper(items[index]!); } })); return results; }
export async function cleanupIranKetabCovers(adminId: string, sessionId: string, fingerprint: string, keys: string[], reason: "completed" | "cancelled" | "expired") { return Promise.all(keys.slice(0, 200).map(async key => { if (!isOwnedTemporaryCoverKey(key, adminId, fingerprint, sessionId)) return { key, deleted: false }; try { await deleteImageUpload(key); console.info("[iranketab.media] cleanup", { sessionId, key, reason }); return { key, deleted: true }; } catch { return { key, deleted: false }; } })); }
