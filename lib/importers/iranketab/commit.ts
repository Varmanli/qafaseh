import { and, eq, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { IranKetabExtractionEnvelope } from "@ghafaseh/iranketab-extractor";
import { db } from "@/db";
import {
  BookEdition,
  BookEditionPublisher,
  BookEditionContributor,
  BookExternalLink,
  CatalogBook,
  CatalogBookContributor,
  ReferenceItem,
} from "@/db/schema";
import { generateUniqueCatalogBookSlug } from "@/lib/book/public-slug";
import { slugify } from "@/lib/book/slug";
import { sanitizeRichTextHtml } from "@/lib/content/rich-text";
import { joinPeople, normalizeIsbn } from "@/lib/books/import/normalize";
import {
  draftFingerprint,
  isOwnedTemporaryCoverKey,
  type IranKetabImportDraftWithPreparedCovers,
} from "./cover-preparation";
import {
  copyImageUpload,
  deleteImageUpload,
  headImageUpload,
} from "@/lib/server/upload-storage";
import {
  createReferenceResolutionCache,
  resolveReferenceItem,
} from "@/lib/reference/service";
import { applyExplicitFields } from "./field-actions";
import {
  applyRelationDiff,
  diffRelations,
  editionFieldPatch,
  splitRelations,
} from "./hardening";
import { iranKetabImportDraftSchema } from "./draft";
import { extractionCollectionLimitIssues, formatIranKetabSchemaIssues, IRANKETAB_COLLECTION_LIMITS } from "./collection-limits";
import {
  finalIranKetabCoverValue,
  finalIranKetabReferenceMediaValue,
} from "./repair-cover-paths";
import {
  advisoryLockKey,
  canonicalIranKetabSourceIdentity,
} from "./server-hardening";
import {
  attachErrorCheckpoint,
  checkpoint,
} from "./error-diagnostics";
import {
  IranKetabCommitError,
  mediaValidationError,
  promotionFailure,
  wrapIranKetabCommitError,
} from "./commit-errors";
export {
  IranKetabCommitError,
  IRANKETAB_COMMIT_ERROR_MESSAGES,
  mediaValidationError,
  promotionFailure,
  wrapIranKetabCommitError,
  type IranKetabCommitErrorCode,
} from "./commit-errors";
export type IranKetabCommitMediaStorage = {
  head: typeof headImageUpload;
  copy: typeof copyImageUpload;
  delete: typeof deleteImageUpload;
};
export async function commitIranKetabImport(params: {
  adminId: string;
  sessionId?: string;
  extraction: IranKetabExtractionEnvelope;
  prepared: IranKetabImportDraftWithPreparedCovers;
  mediaStorage?: IranKetabCommitMediaStorage;
}) {
  const { draft: rawDraft, fingerprint, preparedCovers } = params.prepared;
  const parsedDraft = iranKetabImportDraftSchema.safeParse(rawDraft);
  if (!parsedDraft.success) throw new IranKetabCommitError("INVALID_DRAFT", formatIranKetabSchemaIssues(parsedDraft.error).join(" "));
  const draft = parsedDraft.data;
  let lastCheckpoint = checkpoint(
    "commit_started",
    "commitIranKetabImport",
    "input_validation",
    "read prepared import payload",
  );
  const markCommit = (name: string, stage: string, statement: string) => {
    lastCheckpoint = checkpoint(name, "commitIranKetabImport", stage, statement);
    console.info("[iranketab.commit] checkpoint", lastCheckpoint);
  };
  const preparedReferenceImages = params.prepared.preparedReferenceImages ?? [];
  const mediaStorage = params.mediaStorage ?? {
    head: headImageUpload,
    copy: copyImageUpload,
    delete: deleteImageUpload,
  };
  const draftReferenceCounts = {
    authors: draft.catalog.authors.length,
    translators: draft.editions.reduce((total, edition) => total + (edition.action === "EXCLUDE" ? 0 : edition.translators.length), 0),
    publishers: draft.editions.filter((edition) => edition.action !== "EXCLUDE" && Boolean(edition.publisher)).length,
  };
  console.info("[iranketab.commit] contributor payload", {
    sessionId: params.sessionId ?? null,
    ...draftReferenceCounts,
    entities: draft.entities.map((entity) => ({ type: entity.entityType, name: entity.extractedName, action: entity.action })),
    stagedReferenceImages: preparedReferenceImages.filter((image) => image.status === "PREPARED").length,
  });
  const extractionLimitIssues = extractionCollectionLimitIssues(params.extraction);
  if (extractionLimitIssues.length) throw new IranKetabCommitError("INVALID_DRAFT", extractionLimitIssues.join(" "));
  if (preparedCovers.length > IRANKETAB_COLLECTION_LIMITS.editions) throw new IranKetabCommitError("INVALID_DRAFT", `تعداد «کاورهای آماده‌شده» ${preparedCovers.length.toLocaleString("fa-IR")} مورد است؛ حداکثر مجاز ${IRANKETAB_COLLECTION_LIMITS.editions.toLocaleString("fa-IR")} مورد است.`);
  const parsedContributorCounts = { authors: draft.catalog.authors.length, translators: draft.editions.reduce((n, e) => n + (e.action === "EXCLUDE" ? 0 : e.translators.length), 0), publishers: draft.editions.filter((e) => e.action !== "EXCLUDE" && Boolean(e.publisher)).length };
  const extractedContributorCounts = { authors: params.extraction.book.authors.length, translators: params.extraction.editions.reduce((n, e) => n + e.translators.length, 0), publishers: params.extraction.editions.filter((e) => Boolean(e.publisher.name)).length };
  console.info("[iranketab.commit] contributor boundary", { extraction: extractedContributorCounts, draft: parsedContributorCounts, entities: draft.entities.length });
  if (extractedContributorCounts.authors > 0 && parsedContributorCounts.authors === 0)
    throw new IranKetabCommitError("INVALID_DRAFT", "اطلاعات نویسندگان در پیش‌نویس ثبت نهایی از بین رفته است.");
  if (
    draftFingerprint(rawDraft) !== fingerprint ||
    draft.source.canonicalUrl !== params.extraction.source.canonicalUrl ||
    draft.source.selectedEditionCode !== params.extraction.source.editionCode
  )
    throw new IranKetabCommitError(
      "STALE_DRAFT",
      "پیش‌نویس یا رسانه‌های آماده‌شده دیگر معتبر نیستند.",
    );
  if (
    draft.entities.some((x) => x.action === "UNRESOLVED") ||
    draft.unresolvedIssues.some((x) => x.blocking)
  )
    throw new IranKetabCommitError(
      "INVALID_DRAFT",
      "تعارض یا مرجع حل‌نشده وجود دارد.",
    );
  const promoted: string[] = [];
  const coverUrls = new Map<number, string>();
  const referenceImageUrls = new Map<string, { profile?: string; banner?: string; filename?: string }>();
  const promoteMedia = async () => {
    let promotionCheckpoint = checkpoint(
      "inside_promote_media",
      "promoteMedia",
      "promotion_entry",
      "entered promoteMedia",
    );
    let failedDuringStorageOperation = false;
    const markPromotion = (name: string, stage: string, statement: string) => {
      promotionCheckpoint = checkpoint(name, "promoteMedia", stage, statement);
      lastCheckpoint = promotionCheckpoint;
      console.info("[iranketab.commit] checkpoint", promotionCheckpoint);
    };
    const storageCall = async <T>(
      before: string,
      after: string,
      stage: string,
      statement: string,
      operation: () => Promise<T>,
    ): Promise<T> => {
      markPromotion(before, stage, statement);
      failedDuringStorageOperation = false;
      try {
        const value = await operation();
        markPromotion(after, stage, `${statement} returned`);
        return value;
      } catch (error) {
        failedDuringStorageOperation = true;
        attachErrorCheckpoint(error, promotionCheckpoint);
        throw error;
      }
    };
    markPromotion(
      "inside_promote_media",
      "promotion_entry",
      "entered promoteMedia",
    );
    try {
      for (const preparedCover of preparedCovers.filter(
        (item) => item.status === "PREPARED",
      )) {
        if (
          !preparedCover.objectKey ||
          !isOwnedTemporaryCoverKey(
            preparedCover.objectKey,
            params.adminId,
            fingerprint,
            params.sessionId,
          )
        )
          throw new IranKetabCommitError(
            "STALE_DRAFT",
            "کاور موقت قابل تأیید نیست.",
          );
        if (!fingerprint || !Number.isInteger(preparedCover.extractedEditionIndex) || preparedCover.extractedEditionIndex < 0)
          throw new IranKetabCommitError("FINAL_MEDIA_KEY_GENERATION_FAILED", `فیلد لازم برای کلید نهایی کاور موجود نیست: ${!fingerprint ? "fingerprint" : "extractedEditionIndex"}.`);
        const finalKey = `covers/iranketab-${fingerprint.slice(0, 20)}-${preparedCover.extractedEditionIndex}.webp`;
        console.info("[iranketab.commit] final media key generated", { sourceKey: preparedCover.objectKey, destinationKey: finalKey, extractedEditionIndex: preparedCover.extractedEditionIndex, mediaType: "cover", destinationFolder: "covers" });
        console.info("[iranketab.commit] media checkpoint before HeadObject", { stage: "destination_lookup", sourceKey: preparedCover.objectKey, destinationKey: finalKey, mediaKind: "BOOK_COVER", folder: "covers", contentType: "image/webp", extension: "webp" });
        const prior = await storageCall(
          "before_destination_head",
          "after_destination_head",
          "destination_lookup",
          "headImageUpload(finalKey)",
          () => mediaStorage.head(finalKey),
        );
        console.info("[iranketab.commit] media checkpoint before source HeadObject", { stage: "source_metadata_lookup", sourceKey: preparedCover.objectKey, destinationKey: finalKey, mediaKind: "BOOK_COVER", folder: "covers", contentType: "image/webp", extension: "webp" });
        const metadata = await storageCall(
          "before_source_head",
          "after_source_head",
          "source_metadata_lookup",
          "headImageUpload(preparedCover.objectKey)",
          () => mediaStorage.head(preparedCover.objectKey!),
        );
        const sourceValidationFailures = !metadata ? ["source_missing"] : [
          ...(metadata.contentType !== "image/webp" ? ["content_type_mismatch"] : []),
          ...(metadata.sizeBytes < 1 ? ["source_empty"] : []),
          ...(metadata.sizeBytes > 10 * 1024 * 1024 ? ["source_too_large"] : []),
          ...(metadata.metadata["iranketab-admin"] !== params.adminId ? ["admin_metadata_mismatch"] : []),
          ...(metadata.metadata["iranketab-fingerprint"] !== fingerprint ? ["fingerprint_metadata_mismatch"] : []),
          ...(params.sessionId && metadata.metadata["iranketab-session-id"] !== params.sessionId ? ["session_metadata_mismatch"] : []),
          ...(metadata.metadata["iranketab-edition-index"] !== String(preparedCover.extractedEditionIndex) ? ["edition_index_metadata_mismatch"] : []),
        ];
        if (!prior && sourceValidationFailures.length)
          throw mediaValidationError(
            "STALE_DRAFT",
            "کاور آماده‌شده نیازمند آماده‌سازی مجدد است.",
            {
              functionName: "promoteMedia",
              stage: "source_validation",
              sourceKey: preparedCover.objectKey,
              destinationKey: finalKey,
              failedGuard: sourceValidationFailures.join(","),
              observed: metadata ? {
                contentType: metadata.contentType,
                sizeBytes: metadata.sizeBytes,
                hasAdminMetadata: Boolean(metadata.metadata["iranketab-admin"]),
                hasFingerprintMetadata: Boolean(metadata.metadata["iranketab-fingerprint"]),
                editionIndexMetadata: metadata.metadata["iranketab-edition-index"] ?? null,
              } : null,
            },
          );
        if (!prior) {
          await storageCall(
            "before_copy",
            "after_copy",
            "copy",
            "copyImageUpload(preparedCover.objectKey, finalKey)",
            () => mediaStorage.copy({
              sourceKey: preparedCover.objectKey!,
              destinationKey: finalKey,
              contentType: "image/webp",
              metadata: {
                "iranketab-fingerprint": fingerprint,
                "iranketab-edition-index": String(
                  preparedCover.extractedEditionIndex,
                ),
              },
            }),
          );
          promoted.push(finalKey);
        } else if (prior.metadata["iranketab-fingerprint"] !== fingerprint) {
          throw mediaValidationError(
            "COVER_PROMOTION_FAILED",
            "مقصد کاور با ورود دیگری تداخل دارد.",
            { functionName: "promoteMedia", stage: "destination_validation", sourceKey: preparedCover.objectKey, destinationKey: finalKey, failedGuard: "destination_fingerprint_conflict" },
          );
        }
        const finalMetadata = await storageCall(
          "before_destination_head",
          "after_destination_head",
          "destination_validation",
          "headImageUpload(finalKey) after promotion",
          () => mediaStorage.head(finalKey),
        );
        if (
          !finalMetadata ||
          finalMetadata.contentType !== "image/webp" ||
          finalMetadata.sizeBytes < 1
        )
          throw mediaValidationError(
            "COVER_PROMOTION_FAILED",
            "تأیید کاور نهایی ناموفق بود.",
            { functionName: "promoteMedia", stage: "destination_validation", sourceKey: preparedCover.objectKey, destinationKey: finalKey, failedGuard: !finalMetadata ? "destination_missing" : finalMetadata.contentType !== "image/webp" ? "destination_content_type_mismatch" : "destination_empty" },
          );
        // Persist the canonical Arvan object key. Display code resolves this
        // key to S3_PUBLIC_BASE_URL; /uploads is reserved for real local files.
        markPromotion(
          "before_cover_final_value",
          "cover_path_validation",
          "finalIranKetabCoverValue(finalKey)",
        );
        coverUrls.set(preparedCover.extractedEditionIndex, finalIranKetabCoverValue(finalKey));
      }
      for (const image of preparedReferenceImages.filter((item) => item.status === "PREPARED")) {
        if (!image.objectKey || !isOwnedTemporaryCoverKey(image.objectKey, params.adminId, fingerprint, params.sessionId)) throw new IranKetabCommitError("STALE_DRAFT", "تصویر مرجع موقت قابل تأیید نیست.");
        if (!fingerprint || !image.entityType || !image.kind)
          throw new IranKetabCommitError("FINAL_MEDIA_KEY_GENERATION_FAILED", `فیلد لازم برای کلید نهایی تصویر مرجع موجود نیست: ${!fingerprint ? "fingerprint" : !image.entityType ? "entityType" : "kind"}.`);
        const entityToken = createHash("sha256")
          .update(`${image.entityType}:${image.extractedName}`)
          .digest("hex")
          .slice(0, 16);
        const finalKey = `references/iranketab-${image.entityType.toLowerCase()}-${fingerprint.slice(0, 20)}-${entityToken}-${image.kind.toLowerCase()}.webp`;
        console.info("[iranketab.commit] final media key generated", { sourceKey: image.objectKey, destinationKey: finalKey, entityType: image.entityType, mediaType: image.kind, destinationFolder: "references" });
        console.info("[iranketab.commit] media checkpoint before reference HeadObject", { stage: "reference_destination_lookup", sourceKey: image.objectKey, destinationKey: finalKey, mediaKind: image.kind, folder: "references", contentType: "image/webp", extension: "webp" });
        const priorReference = await storageCall(
          "before_destination_head",
          "after_destination_head",
          "reference_destination_lookup",
          "headImageUpload(reference finalKey)",
          () => mediaStorage.head(finalKey),
        );
        const referenceMetadata = await storageCall(
          "before_source_head",
          "after_source_head",
          "reference_source_metadata_lookup",
          "headImageUpload(reference objectKey)",
          () => mediaStorage.head(image.objectKey!),
        );
        console.info("[iranketab.commit] source HeadObject", { sessionId: params.sessionId ?? null, key: image.objectKey, exists: Boolean(referenceMetadata), kind: image.kind, entityType: image.entityType });
        if (!priorReference && (!referenceMetadata || referenceMetadata.contentType !== "image/webp" || referenceMetadata.sizeBytes < 1 || referenceMetadata.metadata["iranketab-admin"] !== params.adminId || referenceMetadata.metadata["iranketab-fingerprint"] !== fingerprint || (params.sessionId && referenceMetadata.metadata["iranketab-session-id"] !== params.sessionId)))
          throw mediaValidationError("STALE_DRAFT", "تصویر مرجع آماده‌شده نیازمند آماده‌سازی مجدد است.", { functionName: "promoteMedia", stage: "reference_source_validation", sourceKey: image.objectKey, destinationKey: finalKey, failedGuard: !referenceMetadata ? "source_missing" : "metadata_or_content_invalid" });
        if (!priorReference) {
          console.info("[iranketab.commit] media checkpoint before reference CopyObject", { stage: "reference_copy", sourceKey: image.objectKey, destinationKey: finalKey, mediaKind: image.kind, folder: "references", contentType: "image/webp", extension: "webp" });
          await storageCall(
            "before_copy",
            "after_copy",
            "reference_copy",
            "copyImageUpload(reference objectKey, finalKey)",
            () => mediaStorage.copy({ sourceKey: image.objectKey!, destinationKey: finalKey, contentType: "image/webp", metadata: { "iranketab-fingerprint": fingerprint, "iranketab-reference-source": image.sourceUrl } }),
          );
          promoted.push(finalKey);
        }
        const current = referenceImageUrls.get(`${image.entityType}:${image.extractedName}`) ?? {};
        markPromotion(
          "before_reference_final_value",
          "reference_path_validation",
          "finalIranKetabReferenceMediaValue(finalKey)",
        );
        const referenceValue = finalIranKetabReferenceMediaValue(finalKey);
        referenceImageUrls.set(`${image.entityType}:${image.extractedName}`, {
          ...current,
          [image.kind === "PROFILE" ? "profile" : "banner"]: referenceValue,
          ...(image.kind === "PROFILE" ? { filename: finalKey.split("/").pop() } : {}),
        });
      }
    } catch (error) {
      attachErrorCheckpoint(error, promotionCheckpoint);
      await Promise.all(
        promoted.map((key) => mediaStorage.delete(key).catch(() => undefined)),
      );
      console.error("[iranketab.commit] media promotion original error", { stage: "media_promotion", error });
      throw promotionFailure(
        error,
        failedDuringStorageOperation,
        promotionCheckpoint,
      );
    }
  };
  let result;
  try {
    result = await db.transaction(async (tx) => {
      markCommit("before_source_identity", "pre_promotion", "canonicalIranKetabSourceIdentity(draft.source.canonicalUrl)");
      const identity = canonicalIranKetabSourceIdentity(
        draft.source.canonicalUrl,
      );
      markCommit("before_import_advisory_lock", "pre_promotion", "tx.execute import advisory lock");
      await tx.execute(
        sql`select pg_advisory_xact_lock(${advisoryLockKey(identity)})`,
      );
      markCommit("before_source_code_collection", "pre_promotion", "collect source edition codes");
      const sourceCodes = draft.editions.flatMap((item) =>
        item.action === "CREATE_NEW" ? [item.fields.sourceEditionCode] : [],
      );
      for (const code of [...new Set(sourceCodes)].sort())
        await tx.execute(
          sql`select pg_advisory_xact_lock(${advisoryLockKey(`source-edition:${code}`)})`,
        );
      markCommit("before_existing_links_query", "pre_promotion", "query existing IranKetab links");
      const existingLinks = await tx
        .select({
          catalogBookId: BookExternalLink.catalogBookId,
          url: BookExternalLink.url,
        })
        .from(BookExternalLink)
        .where(eq(BookExternalLink.provider, "iranketab"));
      const linked = existingLinks.find((item) => {
        try {
          return canonicalIranKetabSourceIdentity(item.url) === identity;
        } catch {
          return false;
        }
      });
      if (
        linked &&
        draft.catalog.action === "REUSE_EXISTING" &&
        linked.catalogBookId !== draft.catalog.catalogId
      )
        throw new IranKetabCommitError(
          "SOURCE_URL_CONFLICT",
          "این لینک ایران‌کتاب به کتاب دیگری متصل است.",
        );
      markCommit("before_promote_media", "pre_promotion", "await promoteMedia()");
      await promoteMedia();
      markCommit("after_promote_media", "post_promotion", "promoteMedia() returned");
      const entityResult = {
        created: [] as Array<{ entityType: string; id: string; name: string }>,
        reused: [] as Array<{ entityType: string; id: string; name: string }>,
      };
      const referenceCache = createReferenceResolutionCache();
      const resolvedEntityIds = new Map<string, string>();
      const entityKey = (entity: { entityType: string; extractedName: string; entityId?: string }) =>
        entity.entityId ? `${entity.entityType}:id:${entity.entityId}` : `${entity.entityType}:name:${entity.extractedName}`;
      for (const entity of draft.entities) {
        if (entity.action === "IGNORE") continue;
        if (entity.action === "REUSE_EXISTING") {
          const [row] = await tx
            .select()
            .from(ReferenceItem)
            .where(eq(ReferenceItem.id, entity.entityId))
            .limit(1);
          if (!row || row.type !== entity.entityType)
            throw new IranKetabCommitError(
              "STALE_DRAFT",
              "یکی از مراجع انتخاب‌شده تغییر کرده است.",
            );
          const profile = entity.profile;
          const images = referenceImageUrls.get(`${entity.entityType}:${entity.extractedName}`);
          const patch: Partial<typeof ReferenceItem.$inferInsert> = {};
          const put = (key: keyof typeof patch, value: unknown) => {
            if (row[key] != null && String(row[key]).trim() !== "") return;
            if (typeof value === "string" && value.trim()) (patch[key] as unknown) = value.trim();
            else if (typeof value === "number") (patch[key] as unknown) = value;
          };
          put("originalName", profile?.originalName);
          put("description", profile?.description);
          put("birthYear", profile?.birthYear);
          put("deathYear", profile?.deathYear);
          put("countryName", profile?.countryName);
          put("countrySlug", profile?.countrySlug);
          put("website", profile?.website);
          put("sourceUrl", profile?.sourceUrl);
          put("seoTitle", profile?.seoTitle);
          put("seoDescription", profile?.seoDescription);
          if (profile?.metadata && Object.keys(profile.metadata).length) patch.metadata = { ...(row.metadata ?? {}), ...profile.metadata, ...(profile.profileId ? { iranketabProfileId: profile.profileId } : {}) };
          if (entity.profileImageAction === "replace" && images?.profile) patch.coverImage = images.profile;
          if (entity.profileImageAction === "replace" && images?.filename) patch.imageFilename = images.filename;
          if (entity.profileImageAction === "remove") patch.coverImage = null;
          if (entity.bannerImageAction === "replace" && images?.banner) patch.bannerImage = images.banner;
          if (entity.bannerImageAction === "remove") patch.bannerImage = null;
          if (Object.keys(patch).length) await tx.update(ReferenceItem).set(patch).where(eq(ReferenceItem.id, row.id));
          entityResult.reused.push({
            entityType: row.type,
            id: row.id,
            name: row.name,
          });
          resolvedEntityIds.set(entityKey(entity), row.id);
        } else if (entity.action === "CREATE_NEW") {
          const resolved = await resolveReferenceItem(tx, {
            type: entity.entityType,
            input: {
              name: entity.proposedName,
              ...entity.profile,
              metadata: { ...(entity.profile?.metadata ?? {}), ...(entity.profile?.profileId ? { iranketabProfileId: entity.profile.profileId } : {}) },
              imageUrl: referenceImageUrls.get(`${entity.entityType}:${entity.extractedName}`)?.profile ?? entity.profile?.imageUrl,
              bannerImageUrl: referenceImageUrls.get(`${entity.entityType}:${entity.extractedName}`)?.banner ?? entity.profile?.bannerImageUrl,
              imageFilename: referenceImageUrls.get(`${entity.entityType}:${entity.extractedName}`)?.filename,
            },
            cache: referenceCache,
            createdById: params.adminId,
            defaultStatus: "APPROVED",
          });
          if (!resolved)
            throw new IranKetabCommitError(
              "INVALID_DRAFT",
              "نام مرجع معتبر نیست.",
            );
          entityResult[
            resolved.resolution === "created" ? "created" : "reused"
          ].push({
            entityType: entity.entityType,
            id: resolved.id,
            name: resolved.name,
          });
          resolvedEntityIds.set(entityKey(entity), resolved.id);
        }
      }
      let catalogId: string;
      let catalogTitle: string;
      let catalogAction: "CREATED" | "REUSED" | "UPDATED" = "REUSED";
      if (draft.catalog.action === "REUSE_EXISTING") {
        const [row] = await tx
          .select({
            id: CatalogBook.id,
            title: CatalogBook.title,
            subtitle: CatalogBook.subtitle,
            originalTitle: CatalogBook.originalTitle,
            description: CatalogBook.description,
            language: CatalogBook.language,
            firstPublishedYear: CatalogBook.firstPublishedYear,
            author: CatalogBook.author,
            genre: CatalogBook.genre,
          })
          .from(CatalogBook)
          .where(eq(CatalogBook.id, draft.catalog.catalogId))
          .limit(1);
        if (!row)
          throw new IranKetabCommitError(
            "STALE_DRAFT",
            "کتاب انتخاب‌شده دیگر وجود ندارد.",
          );
        const source = {
          subtitle: params.extraction.book.subtitle,
          originalTitle: params.extraction.book.originalTitle,
          description: sanitizeRichTextHtml(params.extraction.book.description),
          language: params.extraction.book.language,
          firstPublishedYear: params.extraction.book.firstPublishedYear,
        };
        const patch = applyExplicitFields(
          row,
          draft.catalog.fieldActions,
          source,
        );
        const relationName = (item: (typeof draft.catalog.authors)[number]) =>
          item.action === "REUSE_EXISTING"
            ? item.displayName
            : item.action === "CREATE_NEW"
              ? item.proposedName
              : item.extractedName;
        const authors = applyRelationDiff(
          diffRelations(
            splitRelations(row.author),
            draft.catalog.authors.map(relationName),
          ),
          { requireOne: true },
        ).join("، ");
        const genres =
          applyRelationDiff(
            diffRelations(
              splitRelations(row.genre),
              draft.catalog.genres.map(relationName),
            ),
          ).join("، ") || null;
        if (authors !== row.author) patch.author = authors;
        if (genres !== row.genre) patch.genre = genres;
        if (Object.keys(patch).length) {
          await tx
            .update(CatalogBook)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(CatalogBook.id, row.id));
          catalogAction = "UPDATED";
        }
        catalogId = row.id;
        catalogTitle = (patch.title as string | undefined) ?? row.title;
      } else {
        const [bySource] = await tx
          .select({ id: CatalogBook.id, title: CatalogBook.title })
          .from(CatalogBook)
          .where(
            linked
              ? eq(CatalogBook.id, linked.catalogBookId)
              : eq(CatalogBook.sourceUrl, draft.source.canonicalUrl),
          )
          .limit(1);
        if (bySource) {
          catalogId = bySource.id;
          catalogTitle = bySource.title;
        } else {
          const id = crypto.randomUUID();
          const slug = await generateUniqueCatalogBookSlug(
            draft.catalog.fields.title,
            id,
          );
          const [created] = await tx
            .insert(CatalogBook)
            .values({
              id,
              slug,
              slugNormalized: slugify(slug),
              title: draft.catalog.fields.title.trim(),
              subtitle: draft.catalog.fields.subtitle,
              originalTitle: draft.catalog.fields.originalTitle,
              description: sanitizeRichTextHtml(
                draft.catalog.fields.description,
              ),
              author: joinPeople(
                draft.catalog.authors.map((x) => ({
                  name:
                    x.action === "REUSE_EXISTING"
                      ? x.displayName
                      : x.action === "CREATE_NEW"
                        ? x.proposedName
                        : x.extractedName,
                })),
              ),
              genre: joinPeople(
                draft.catalog.genres.map((x) => ({
                  name:
                    x.action === "REUSE_EXISTING"
                      ? x.displayName
                      : x.action === "CREATE_NEW"
                        ? x.proposedName
                        : x.extractedName,
                })),
              ),
              country: draft.catalog.country
                ? draft.catalog.country.action === "REUSE_EXISTING"
                  ? draft.catalog.country.displayName
                  : draft.catalog.country.action === "CREATE_NEW"
                    ? draft.catalog.country.proposedName
                    : null
                : null,
              language: draft.catalog.fields.language,
              firstPublishedYear: draft.catalog.fields.firstPublishedYear,
              sourceName: "iranketab",
              sourceUrl: draft.source.canonicalUrl,
              status: "APPROVED",
              createdById: params.adminId,
            })
            .returning({ id: CatalogBook.id, title: CatalogBook.title });
          catalogId = created.id;
          catalogTitle = created.title;
          catalogAction = "CREATED";
        }
      }
      const editions: Array<{
        extractedEditionIndex: number;
        action: string;
        editionId?: string;
        catalogId?: string;
        coverAction: string;
      }> = [];
      for (const decision of draft.editions) {
        if (decision.action === "EXCLUDE") {
          editions.push({
            extractedEditionIndex: decision.extractedEditionIndex,
            action: "EXCLUDED",
            coverAction: "SKIPPED",
          });
          continue;
        }
        const source =
          params.extraction.editions[decision.extractedEditionIndex];
        if (!source)
          throw new IranKetabCommitError(
            "INVALID_DRAFT",
            "نسخه منبع معتبر نیست.",
          );
        if (decision.action === "REUSE_EXISTING") {
          const [existing] = await tx
            .select({
              id: BookEdition.id,
              catalogBookId: BookEdition.catalogBookId,
              titleOverride: BookEdition.titleOverride,
              publisher: BookEdition.publisher,
              translators: BookEdition.translator,
              isbn10: BookEdition.isbn10,
              isbn13: BookEdition.isbn13,
              publishedYear: BookEdition.publishedYear,
              pageCount: BookEdition.pageCount,
              editionDescription: BookEdition.editionDescription,
              coverImage: BookEdition.coverImage,
            })
            .from(BookEdition)
            .where(eq(BookEdition.id, decision.editionId))
            .limit(1);
          if (!existing || existing.catalogBookId !== catalogId)
            throw new IranKetabCommitError(
              "STALE_DRAFT",
              "نسخه انتخاب‌شده با کتاب سازگار نیست.",
            );
          const sourceFields = {
            titleOverride: source.titleOverride || null,
            publisher: source.publisher.name || null,
            translators: joinPeople(source.translators),
            isbn10: normalizeIsbn(source.isbn10),
            isbn13: normalizeIsbn(source.isbn13),
            publishedYear: source.publishedYear,
            pageCount: source.pageCount,
            editionDescription: sanitizeRichTextHtml(source.editionDescription),
          };
          const patch = editionFieldPatch(
            existing,
            sourceFields,
            decision.fieldActions,
          );
          const selectedCover = coverUrls.get(decision.extractedEditionIndex);
          const coverPatch =
            decision.coverAction.action === "IMPORT_SOURCE" &&
            selectedCover &&
            selectedCover !== existing.coverImage
              ? { coverImage: selectedCover, coverFilename: "cover.webp" }
              : {};
          const changed =
            Object.keys(patch).length > 0 || Object.keys(coverPatch).length > 0;
          if (changed) {
            const update = { ...patch, ...coverPatch, updatedAt: new Date() };
            await tx
              .update(BookEdition)
              .set(update)
              .where(eq(BookEdition.id, existing.id));
          }
          editions.push({
            extractedEditionIndex: decision.extractedEditionIndex,
            action: changed ? "UPDATED" : "REUSED",
            editionId: existing.id,
            catalogId,
            coverAction: Object.keys(coverPatch).length
              ? "ATTACHED"
              : decision.coverAction.action === "KEEP_EXISTING"
                ? "KEPT"
                : "SKIPPED",
          });
          continue;
        }
        const isbn13 = normalizeIsbn(decision.fields.isbn13);
        const isbn10 = normalizeIsbn(decision.fields.isbn10);
        const [sameSource] = await tx
          .select({
            id: BookEdition.id,
            catalogBookId: BookEdition.catalogBookId,
          })
          .from(BookEdition)
          .where(
            and(
              eq(BookEdition.sourceName, "iranketab"),
              eq(
                BookEdition.sourceEditionCode,
                decision.fields.sourceEditionCode,
              ),
            ),
          )
          .limit(1);
        if (sameSource) {
          if (sameSource.catalogBookId !== catalogId)
            throw new IranKetabCommitError(
              "SOURCE_EDITION_CONFLICT",
              "کد نسخه ایران‌کتاب به نسخه دیگری متصل است.",
            );
          editions.push({
            extractedEditionIndex: decision.extractedEditionIndex,
            action: "REUSED",
            editionId: sameSource.id,
            catalogId,
            coverAction: "SKIPPED",
          });
          continue;
        }
        const coverImage =
          coverUrls.get(decision.extractedEditionIndex) ?? null;
        const [created] = await tx
          .insert(BookEdition)
          .values({
            id: crypto.randomUUID(),
            catalogBookId: catalogId,
            titleOverride: decision.fields.titleOverride,
            translator: joinPeople(
              decision.translators.map((x) => ({
                name:
                  x.action === "REUSE_EXISTING"
                    ? x.displayName
                    : x.action === "CREATE_NEW"
                      ? x.proposedName
                      : x.extractedName,
              })),
            ),
            publisher: decision.publisher
              ? decision.publisher.action === "REUSE_EXISTING"
                ? decision.publisher.displayName
                : decision.publisher.action === "CREATE_NEW"
                  ? decision.publisher.proposedName
                  : null
              : null,
            isbn: isbn13 ?? isbn10,
            isbn10,
            isbn13,
            format: "PHYSICAL",
            coverImage,
            coverFilename: coverImage ? "cover.webp" : null,
            publishedYear: decision.fields.publishedYear,
            editionDescription: decision.fields.editionDescription,
            pageCount: decision.fields.pageCount,
            language:
              draft.catalog.action === "CREATE_NEW"
                ? draft.catalog.fields.language
                : params.extraction.book.language,
            sourceName: "iranketab",
            sourceUrl: source.sourceUrl,
            sourceEditionCode: source.sourceEditionCode,
            status: "APPROVED",
            createdById: params.adminId,
          })
          .returning({ id: BookEdition.id });
        editions.push({
          extractedEditionIndex: decision.extractedEditionIndex,
          action: "CREATED",
          editionId: created.id,
          catalogId,
          coverAction: coverImage ? "ATTACHED" : "SKIPPED",
        });
      }
      if (!linked)
        await tx.insert(BookExternalLink).values({
          catalogBookId: catalogId,
          provider: "iranketab",
          label: "ایران‌کتاب",
          url: draft.source.canonicalUrl,
          type: "print",
          isActive: true,
          sortOrder: 0,
        });
      for (const [index, entity] of draft.catalog.authors.entries()) {
        const referenceId = resolvedEntityIds.get(entityKey(entity));
        if (!referenceId) throw new IranKetabCommitError("DATABASE_TRANSACTION_FAILED", `مرجع نویسنده «${entity.extractedName}» (temporary ID: ${"entityId" in entity ? entity.entityId : "none"}, expected resolution key: ${entityKey(entity)}, source profile URL: ${entity.profile?.sourceUrl ?? draft.source.canonicalUrl}) حل نشد.`);
        await tx.insert(CatalogBookContributor).values({ catalogBookId: catalogId, referenceItemId: referenceId, role: "AUTHOR", sortOrder: index, sourceName: "iranketab", sourceUrl: entity.profile?.sourceUrl ?? draft.source.canonicalUrl }).onConflictDoNothing();
      }
      let createdContributorRelations = 0;
      let createdPublisherRelations = 0;
      for (const decision of draft.editions) {
        if (decision.action === "EXCLUDE") continue;
        const editionId = editions.find((item) => item.extractedEditionIndex === decision.extractedEditionIndex)?.editionId;
        if (!editionId) continue;
        for (const [order, entity] of decision.translators.entries()) {
          const referenceId = resolvedEntityIds.get(entityKey(entity));
          if (!referenceId) throw new IranKetabCommitError("DATABASE_TRANSACTION_FAILED", `مرجع مترجم «${entity.extractedName}» (temporary ID: ${"entityId" in entity ? entity.entityId : "none"}, expected resolution key: ${entityKey(entity)}, source profile URL: ${entity.profile?.sourceUrl ?? draft.source.canonicalUrl}) حل نشد.`);
          await tx.insert(BookEditionContributor).values({ bookEditionId: editionId, referenceItemId: referenceId, role: "TRANSLATOR", sortOrder: order, sourceName: "iranketab", sourceUrl: entity.profile?.sourceUrl ?? draft.source.canonicalUrl }).onConflictDoNothing();
          createdContributorRelations += 1;
        }
        if (decision.publisher) {
          const entity = decision.publisher;
          const referenceId = resolvedEntityIds.get(entityKey(entity));
          if (!referenceId) throw new IranKetabCommitError("DATABASE_TRANSACTION_FAILED", `مرجع ناشر «${entity.extractedName}» (temporary ID: ${"entityId" in entity ? entity.entityId : "none"}, expected resolution key: ${entityKey(entity)}, source profile URL: ${entity.profile?.sourceUrl ?? draft.source.canonicalUrl}) حل نشد.`);
          await tx.insert(BookEditionPublisher).values({ bookEditionId: editionId, referenceItemId: referenceId, sortOrder: 0, sourceName: "iranketab", sourceUrl: entity.profile?.sourceUrl ?? draft.source.canonicalUrl }).onConflictDoNothing();
          createdPublisherRelations += 1;
        }
      }
      const [catalog] = await tx
        .select({ primaryEditionId: CatalogBook.primaryEditionId })
        .from(CatalogBook)
        .where(eq(CatalogBook.id, catalogId));
      const first = editions.find((x) => x.action === "CREATED")?.editionId;
      if (!catalog?.primaryEditionId && first)
        await tx
          .update(CatalogBook)
          .set({ primaryEditionId: first, updatedAt: new Date() })
          .where(eq(CatalogBook.id, catalogId));
      console.info("[iranketab.commit] contributor relations persisted", { authors: draft.catalog.authors.length, translators: createdContributorRelations, publishers: createdPublisherRelations, resolved: resolvedEntityIds.size });
      return {
        catalog: { action: catalogAction, id: catalogId, title: catalogTitle },
        editions,
        entities: entityResult,
      };
    });
  } catch (error) {
    attachErrorCheckpoint(error, lastCheckpoint);
    await Promise.all(
      promoted.map((key) => mediaStorage.delete(key).catch(() => undefined)),
    );
    // Staged sources are intentionally retained: a failed transaction must be retryable.
    if (error instanceof IranKetabCommitError) throw error;
    throw wrapIranKetabCommitError(
      "DATABASE_TRANSACTION_FAILED",
      "تراکنش ثبت کتاب انجام نشد.",
      error,
      lastCheckpoint,
    );
  }
  const cleanupWarnings: string[] = [];
  for (const preparedCover of [...preparedCovers, ...preparedReferenceImages]) {
    const tempKey = (preparedCover as { objectKey?: string }).objectKey;
    if (preparedCover.status === "PREPARED" && tempKey && (!params.sessionId || isOwnedTemporaryCoverKey(tempKey, params.adminId, fingerprint, params.sessionId)))
      try {
        await mediaStorage.delete(tempKey);
      } catch {
        cleanupWarnings.push(
          "پاک‌سازی یکی از کاورهای موقت بعد از ثبت ناموفق بود.",
        );
      }
  }
  return { ...result, warnings: cleanupWarnings };
}
