import { and, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { BookEdition, CatalogBook } from "@/db/schema";
import { normalizeCoverImage } from "@/lib/book/cover";
import { generateUniqueCatalogBookSlug } from "@/lib/book/public-slug";
import { slugify } from "@/lib/book/slug";
import { serializeGenres } from "@/lib/book/genres";
import { buildImportPreview } from "@/lib/books/import/validate";
import {
  joinPeople,
  canPersistCoverUrl,
  normalizeIsbn,
  referenceNames,
} from "@/lib/books/import/normalize";
import {
  createReferenceResolutionCache,
  resolveReferenceItem,
} from "@/lib/reference/service";
import type {
  ImportPreviewResponse,
  ImportResultResponse,
  NormalizedImportBook,
  ReferencePreviewSummary,
} from "@/lib/books/import/types";

type ImportTransactionError = {
  rowNumbers: number[];
  title: string;
  message: string;
};

type DbErrorCause = {
  code?: string;
  detail?: string;
  constraint?: string;
  column?: string;
  table?: string;
  schema?: string;
};

async function findReusableCatalogBook(book: NormalizedImportBook) {
  const title = book.title.trim();
  const firstAuthor = (book.authors[0]?.name ?? "").trim();

  const [existing] = await db
    .select({
      id: CatalogBook.id,
      title: CatalogBook.title,
      originalTitle: CatalogBook.originalTitle,
      primaryEditionId: CatalogBook.primaryEditionId,
    })
    .from(CatalogBook)
    .where(
      and(
        ilike(CatalogBook.title, title),
        ilike(CatalogBook.author, `%${firstAuthor}%`),
      ),
    )
    .limit(1);

  if (!existing) return null;

  if (
    book.originalTitle &&
    existing.originalTitle &&
    book.originalTitle.trim().toLowerCase() !== existing.originalTitle.trim().toLowerCase()
  ) {
    return null;
  }

  return existing;
}

function resolveEditionCover(
  coverFilename: string | null | undefined,
  coverUrl: string | null | undefined,
) {
  return {
    // Preview rejects local paths; keep this second guard so no caller can
    // persist a container-local URL by bypassing the preview endpoint.
    coverImage: canPersistCoverUrl(coverUrl ?? null)
      ? normalizeCoverImage(coverUrl ?? null)
      : null,
    coverFilename: coverFilename?.trim() || null,
  };
}

function addReferenceSummary(
  target: ReferencePreviewSummary,
  key: keyof ReferencePreviewSummary,
) {
  target[key] += 1;
}

function extractDbErrorCause(error: unknown): DbErrorCause & { cause?: unknown } {
  if (!error || typeof error !== "object") {
    return {};
  }

  const maybeError = error as { cause?: unknown };
  const cause =
    maybeError.cause && typeof maybeError.cause === "object"
      ? (maybeError.cause as Record<string, unknown>)
      : undefined;

  return {
    cause: maybeError.cause,
    code: typeof cause?.code === "string" ? cause.code : undefined,
    detail: typeof cause?.detail === "string" ? cause.detail : undefined,
    constraint: typeof cause?.constraint === "string" ? cause.constraint : undefined,
    column: typeof cause?.column === "string" ? cause.column : undefined,
    table: typeof cause?.table === "string" ? cause.table : undefined,
    schema: typeof cause?.schema === "string" ? cause.schema : undefined,
  };
}

export async function importNormalizedBooks(
  books: NormalizedImportBook[],
  adminId: string,
  previewInput?: ImportPreviewResponse,
): Promise<ImportResultResponse & { transactionErrors: ImportTransactionError[] }> {
  const preview = previewInput ?? await buildImportPreview(books);
  const errors: string[] = [];
  const transactionErrors: ImportTransactionError[] = [];
  const result: ImportResultResponse = {
    receivedBooks: preview.summary.totalBooks,
    receivedEditions: preview.summary.totalEditions,
    validBooks: preview.validCount,
    validEditions: preview.summary.readyEditions,
    importedCount: 0,
    skippedCount: 0,
    skippedBooks: 0,
    skippedEditions: 0,
    invalidCount: preview.invalidCount,
    invalidBooks: preview.invalidCount,
    createdBooks: 0,
    updatedBooks: 0,
    reusedBooks: 0,
    createdEditions: 0,
    updatedEditions: 0,
    skippedDuplicateEditions: 0,
    failedBooks: 0,
    failedEditions: 0,
    referenceItems: { created: 0, reused: 0, updated: 0 },
    errors,
  };

  const referenceCache = createReferenceResolutionCache();

  for (const previewBook of preview.books) {
    const importableEditions = previewBook.editions.filter(
      (edition) => edition.isValid && edition.duplicateState !== "existing_edition",
    );

    if (previewBook.errors.length > 0 || importableEditions.length === 0) {
      result.failedBooks += 1;
      result.failedEditions += previewBook.editions.length;
      result.skippedBooks += 1;
      result.skippedEditions += previewBook.editions.length;
      errors.push(
        `ردیف ${previewBook.rowNumbers.join("، ")}: کتاب «${previewBook.title || "بدون عنوان"}» آماده‌ی واردسازی نیست.`,
      );
      continue;
    }

    try {
      let createdCatalogBook = false;
      let reusedCatalogBook = false;
      let createdEditionCount = 0;
      let skippedDuplicateEditionCount = 0;
      const referenceSummaryDelta = emptyReferenceSummary();

      await db.transaction(async (tx) => {
        const reusableBook = previewBook.duplicateState === "existing_book"
          ? await findReusableCatalogBook(previewBook)
          : null;

        const catalogBookId = reusableBook
          ? reusableBook.id
          : await (async () => {
              const id = crypto.randomUUID();
              const slug = await generateUniqueCatalogBookSlug(previewBook.title, id);
              const [created] = await tx
                .insert(CatalogBook)
                .values({
                  id,
                  title: previewBook.title,
                  subtitle: previewBook.subtitle ?? null,
                  slug,
                  slugNormalized: slugify(slug),
                  originalTitle: previewBook.originalTitle ?? null,
                  description: previewBook.description ?? null,
                  coverImage: null,
                  author: joinPeople(previewBook.authors),
                  language: previewBook.language || "fa",
                  genre: serializeGenres(referenceNames(previewBook.genres)),
                  country: previewBook.country?.name ?? null,
                  firstPublishedYear: previewBook.firstPublishedYear ?? null,
                  sourceName: previewBook.sourceName ?? "bulk_import",
                  sourceUrl: previewBook.sourceUrl ?? null,
                  status: previewBook.status.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED",
                  createdById: adminId,
                  updatedAt: new Date(),
                })
                .returning({ id: CatalogBook.id });
              return created.id;
            })();
        let firstCreatedEditionId: string | null = null;

        if (reusableBook) {
          reusedCatalogBook = true;
        } else {
          createdCatalogBook = true;
        }

        for (const author of previewBook.authors) {
          const resolved = await resolveReferenceItem(tx, {
            type: "AUTHOR",
            input: author,
            cache: referenceCache,
            createdById: adminId,
            defaultStatus: "APPROVED",
          });
          if (resolved) addReferenceSummary(referenceSummaryDelta, resolved.resolution);
        }

        for (const genre of previewBook.genres) {
          const resolved = await resolveReferenceItem(tx, {
            type: "GENRE",
            input: genre,
            cache: referenceCache,
            createdById: adminId,
            defaultStatus: "APPROVED",
          });
          if (resolved) addReferenceSummary(referenceSummaryDelta, resolved.resolution);
        }

        if (previewBook.country) {
          const resolved = await resolveReferenceItem(tx, {
            type: "COUNTRY",
            input: previewBook.country,
            cache: referenceCache,
            createdById: adminId,
            defaultStatus: "APPROVED",
          });
          if (resolved) addReferenceSummary(referenceSummaryDelta, resolved.resolution);
        }

        for (const edition of previewBook.editions) {
          if (!edition.isValid) {
            result.failedEditions += 1;
            result.skippedEditions += 1;
            continue;
          }
          if (edition.duplicateState === "existing_edition") {
            skippedDuplicateEditionCount += 1;
            result.skippedEditions += 1;
            continue;
          }

          const normalizedIsbn13 = normalizeIsbn(edition.isbn13);
          const normalizedIsbn10 = normalizeIsbn(edition.isbn10);

          if (normalizedIsbn13 || normalizedIsbn10) {
            const [existingEdition] = await tx
              .select({ id: BookEdition.id })
              .from(BookEdition)
              .where(
                normalizedIsbn13
                  ? eq(BookEdition.isbn13, normalizedIsbn13)
                  : eq(BookEdition.isbn10, normalizedIsbn10!),
              )
              .limit(1);

            if (existingEdition) {
              skippedDuplicateEditionCount += 1;
              result.skippedEditions += 1;
              continue;
            }
          }

          for (const translator of edition.translators) {
            const resolved = await resolveReferenceItem(tx, {
              type: "TRANSLATOR",
              input: translator,
              cache: referenceCache,
              createdById: adminId,
              defaultStatus: "APPROVED",
            });
            if (resolved) addReferenceSummary(referenceSummaryDelta, resolved.resolution);
          }

          if (edition.publisher) {
            const resolved = await resolveReferenceItem(tx, {
              type: "PUBLISHER",
              input: edition.publisher,
              cache: referenceCache,
              createdById: adminId,
              defaultStatus: "APPROVED",
            });
            if (resolved) addReferenceSummary(referenceSummaryDelta, resolved.resolution);
          }

          const editionCover = resolveEditionCover(
            edition.coverFilename,
            edition.coverUrl,
          );

          const editionId = crypto.randomUUID();
          await tx.insert(BookEdition).values({
            id: editionId,
            catalogBookId,
            titleOverride: edition.titleOverride ?? null,
            translator: edition.translators.length > 0 ? joinPeople(edition.translators) : null,
            publisher: edition.publisher?.name ?? null,
            isbn: normalizedIsbn13 ?? normalizedIsbn10,
            isbn10: normalizedIsbn10,
            isbn13: normalizedIsbn13,
            format: "PHYSICAL",
            coverImage: editionCover.coverImage,
            coverFilename: editionCover.coverFilename,
            publishedYear: edition.publishedYear ?? null,
            editionLabel: edition.titleOverride ?? null,
            editionDescription: edition.editionDescription ?? null,
            pageCount: edition.pageCount ?? null,
            language: previewBook.language || "fa",
            sourceName: edition.sourceName ?? previewBook.sourceName ?? "bulk_import",
            sourceUrl: edition.sourceUrl ?? previewBook.sourceUrl ?? null,
            sourceEditionCode: edition.sourceEditionCode ?? null,
            status: edition.status.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED",
            createdById: adminId,
            updatedAt: new Date(),
          });

          firstCreatedEditionId ??= editionId;
          createdEditionCount += 1;
        }

        if (firstCreatedEditionId && !reusableBook?.primaryEditionId) {
          await tx
            .update(CatalogBook)
            .set({ primaryEditionId: firstCreatedEditionId, updatedAt: new Date() })
            .where(and(eq(CatalogBook.id, catalogBookId), sql`${CatalogBook.primaryEditionId} is null`));
        }
      });

      if (createdCatalogBook) {
        result.createdBooks += 1;
      }
      if (reusedCatalogBook) {
        result.reusedBooks += 1;
      }
      result.importedCount += 1;
      result.createdEditions += createdEditionCount;
      result.skippedDuplicateEditions += skippedDuplicateEditionCount;
      result.referenceItems.created += referenceSummaryDelta.created;
      result.referenceItems.reused += referenceSummaryDelta.reused;
      result.referenceItems.updated += referenceSummaryDelta.updated;
    } catch (error) {
      result.failedBooks += 1;
      result.failedEditions += importableEditions.length;
      result.skippedBooks += 1;
      result.skippedEditions += importableEditions.length;
      const message =
        error instanceof Error ? error.message : "خطای ناشناخته در تراکنش واردسازی.";
      const dbCause = extractDbErrorCause(error);
      transactionErrors.push({
        rowNumbers: previewBook.rowNumbers,
        title: previewBook.title,
        message,
      });
      console.error("admin import transaction failed", {
        rowNumbers: previewBook.rowNumbers,
        title: previewBook.title,
        importableEditions: importableEditions.length,
        error: message,
        cause: dbCause.cause,
        causeCode: dbCause.code,
        causeDetail: dbCause.detail,
        causeConstraint: dbCause.constraint,
        causeColumn: dbCause.column,
        causeTable: dbCause.table,
        causeSchema: dbCause.schema,
      });
      errors.push(
        `کتاب «${previewBook.title}» وارد نشد${error instanceof Error ? `: ${error.message}` : "."}`,
      );
    }
  }

  result.skippedCount = result.skippedBooks;

  return {
    ...result,
    transactionErrors,
  };
}

function emptyReferenceSummary(): ReferencePreviewSummary {
  return { created: 0, reused: 0, updated: 0 };
}
