import { and, desc, eq, ilike, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { ReferenceItem } from "@/db/schema";
import { slugify } from "@/lib/book/slug";
import { normalizeCoverImage } from "@/lib/book/cover";
import { hasMultiValueSeparator, splitMultiValueText } from "@/lib/book/genres";
import { normalizeReferenceName } from "@/lib/reference/normalize";
import type {
  ReferenceTypeValue,
  UpdateReferenceInput,
} from "@/lib/validations/reference";

export class ReferenceError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
    this.name = "ReferenceError";
  }
}

export interface ReferenceItemDTO {
  id: string;
  type: ReferenceTypeValue;
  name: string;
  slug: string | null;
  coverImage: string | null;
  bannerImage: string | null;
  originalName: string | null;
  description: string | null;
  shortDescription: string | null;
  imageFilename: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  birthYear: number | null;
  deathYear: number | null;
  countryName: string | null;
  countrySlug: string | null;
  website: string | null;
  metadata: Record<string, unknown> | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
}

export interface ReferenceSearchPage {
  items: ReferenceItemDTO[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export type ImportReferenceInput =
  | string
  | {
      id?: string;
  name?: string | null;
  originalName?: string | null;
  slug?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  bannerImageUrl?: string | null;
  imageFilename?: string | null;
  website?: string | null;
  country?: ImportReferenceInput | null;
  countryName?: string | null;
  countrySlug?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourceId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: "pending" | "approved" | "rejected";
    };

export type NormalizedReferenceInput = {
  id?: string;
  name: string;
  normalizedName: string;
  originalName?: string | null;
  slug?: string | null;
  normalizedSlug?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  bannerImageUrl?: string | null;
  imageFilename?: string | null;
  website?: string | null;
  countryName?: string | null;
  countrySlug?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourceId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  metadata?: Record<string, unknown> | null;
  birthYear?: number | null;
  deathYear?: number | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
};

export type ReferenceResolutionStatus = "reused" | "created" | "updated";

export type ResolvedReferenceItem = ReferenceItemDTO & {
  resolution: ReferenceResolutionStatus;
};

type ReferenceRow = typeof ReferenceItem.$inferSelect;

type ReferenceExecutor = {
  select: typeof db.select;
  insert: typeof db.insert;
  update: typeof db.update;
};

type ReferenceResolutionCache = {
  byKey: Map<string, ResolvedReferenceItem>;
  byType: Map<ReferenceTypeValue, ReferenceRow[]>;
};

const REFERENCE_COLUMNS = {
  id: ReferenceItem.id,
  type: ReferenceItem.type,
  name: ReferenceItem.name,
  slug: ReferenceItem.slug,
  coverImage: ReferenceItem.coverImage,
  bannerImage: ReferenceItem.bannerImage,
  originalName: ReferenceItem.originalName,
  description: ReferenceItem.description,
  shortDescription: ReferenceItem.shortDescription,
  imageFilename: ReferenceItem.imageFilename,
  sourceName: ReferenceItem.sourceName,
  sourceUrl: ReferenceItem.sourceUrl,
  seoTitle: ReferenceItem.seoTitle,
  seoDescription: ReferenceItem.seoDescription,
  birthYear: ReferenceItem.birthYear,
  deathYear: ReferenceItem.deathYear,
  countryName: ReferenceItem.countryName,
  countrySlug: ReferenceItem.countrySlug,
  website: ReferenceItem.website,
  metadata: ReferenceItem.metadata,
  status: ReferenceItem.status,
  createdAt: ReferenceItem.createdAt,
};

function toApprovalStatus(
  value: string | null | undefined,
): "PENDING" | "APPROVED" | "REJECTED" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "approved") return "APPROVED";
  if (normalized === "rejected") return "REJECTED";
  if (normalized === "pending") return "PENDING";
  return undefined;
}

function trimNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export { normalizeReferenceName } from "@/lib/reference/normalize";

function cacheKey(type: ReferenceTypeValue, key: string) {
  return `${type}:${key}`;
}

function candidateCacheKeys(
  type: ReferenceTypeValue,
  input: NormalizedReferenceInput,
): string[] {
  const keys = [cacheKey(type, `name:${input.normalizedName}`)];
  if (input.id) keys.push(cacheKey(type, `id:${input.id}`));
  if (input.normalizedSlug) keys.push(cacheKey(type, `slug:${input.normalizedSlug}`));
  if (input.sourceName && (input.sourceId || input.sourceUrl)) {
    keys.push(
      cacheKey(
        type,
        `source:${normalizeReferenceName(input.sourceName)}:${input.sourceId ?? ""}:${input.sourceUrl ?? ""}`,
      ),
    );
  }
  if (input.originalName) {
    keys.push(cacheKey(type, `original:${normalizeReferenceName(input.originalName)}`));
  }
  return keys;
}

function hydrateCache(
  cache: ReferenceResolutionCache | undefined,
  type: ReferenceTypeValue,
  input: NormalizedReferenceInput,
  item: ResolvedReferenceItem,
) {
  if (!cache) return;
  for (const key of candidateCacheKeys(type, input)) {
    cache.byKey.set(key, item);
  }
}

function updateTypeCache(
  cache: ReferenceResolutionCache | undefined,
  row: ReferenceRow,
) {
  if (!cache) return;
  const rows = cache.byType.get(row.type);
  if (!rows) {
    cache.byType.set(row.type, [row]);
    return;
  }

  const index = rows.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    rows[index] = row;
  } else {
    rows.push(row);
  }
}

function toDto(row: ReferenceRow): ReferenceItemDTO {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    slug: row.slug,
    coverImage: normalizeCoverImage(row.coverImage),
    bannerImage: row.bannerImage,
    originalName: row.originalName,
    description: row.description,
    shortDescription: row.shortDescription,
    imageFilename: row.imageFilename,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    countryName: row.countryName,
    countrySlug: row.countrySlug,
    website: row.website,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    status: row.status,
    createdAt: row.createdAt,
  };
}

async function uniqueReferenceSlug(
  type: ReferenceTypeValue,
  rawName: string,
  excludeId?: string,
  executor: ReferenceExecutor = db,
): Promise<string> {
  const base = slugify(rawName) || "item";
  const rows = await executor
    .select({ id: ReferenceItem.id, slug: ReferenceItem.slug })
    .from(ReferenceItem)
    .where(
      and(
        eq(ReferenceItem.type, type),
        or(eq(ReferenceItem.slug, base), like(ReferenceItem.slug, `${base}-%`)),
      ),
    );
  const taken = new Set(
    rows
      .filter((row) => row.id !== excludeId)
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function createReferenceResolutionCache(): ReferenceResolutionCache {
  return {
    byKey: new Map(),
    byType: new Map(),
  };
}

export function normalizeReferenceInput(
  input: ImportReferenceInput,
): NormalizedReferenceInput | null {
  if (typeof input === "string") {
    const name = trimNullable(input);
    if (!name) return null;
    return {
      name,
      normalizedName: normalizeReferenceName(name),
    };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const name = trimNullable(input.name);
  if (!name) return null;

  const slug = trimNullable(input.slug);

  return {
    id: trimNullable(input.id) ?? undefined,
    name,
    normalizedName: normalizeReferenceName(name),
    originalName: trimNullable(input.originalName),
    slug,
    normalizedSlug: slug ? slugify(slug) || slug : null,
    description: trimNullable(input.description),
    shortDescription: trimNullable(input.shortDescription),
    imageUrl: trimNullable(input.imageUrl),
    bannerImageUrl: trimNullable(input.bannerImageUrl),
    imageFilename: trimNullable(input.imageFilename),
    website: trimNullable(input.website),
    countryName: trimNullable(
      typeof input.country === "object" && input.country && !Array.isArray(input.country)
        ? input.country.name
        : input.countryName,
    ),
    countrySlug:
      trimNullable(
        typeof input.country === "object" && input.country && !Array.isArray(input.country)
          ? input.country.slug
          : input.countrySlug,
      ) ?? undefined,
    sourceName: trimNullable(input.sourceName),
    sourceUrl: trimNullable(input.sourceUrl),
    sourceId: trimNullable(input.sourceId),
    seoTitle: trimNullable(input.seoTitle),
    seoDescription: trimNullable(input.seoDescription),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : null,
    birthYear: typeof input.birthYear === "number" ? input.birthYear : null,
    deathYear: typeof input.deathYear === "number" ? input.deathYear : null,
    status: toApprovalStatus(input.status),
  };
}

async function loadReferenceRows(
  executor: ReferenceExecutor,
  type: ReferenceTypeValue,
  cache?: ReferenceResolutionCache,
): Promise<ReferenceRow[]> {
  const cached = cache?.byType.get(type);
  if (cached) return cached;

  const rows = await executor.select().from(ReferenceItem).where(eq(ReferenceItem.type, type));
  cache?.byType.set(type, rows);
  return rows;
}

function findReferenceMatch(
  rows: ReferenceRow[],
  type: ReferenceTypeValue,
  input: NormalizedReferenceInput,
): ReferenceRow | null {
  if (input.id) {
    const exactId = rows.find((row) => row.type === type && row.id === input.id);
    if (exactId) return exactId;
  }

  if (input.normalizedSlug) {
    const bySlug = rows.find(
      (row) => row.type === type && row.slug && slugify(row.slug) === input.normalizedSlug,
    );
    if (bySlug) return bySlug;
  }

  if (input.sourceUrl) {
    const bySourceUrl = rows.find(
      (row) => row.type === type && row.sourceUrl && normalizeSourceUrl(row.sourceUrl) === normalizeSourceUrl(input.sourceUrl!),
    );
    if (bySourceUrl) return bySourceUrl;
  }

  const byName = rows.find(
    (row) =>
      row.type === type && normalizeReferenceName(row.name) === input.normalizedName,
  );
  if (byName) return byName;

  if (input.originalName) {
    const normalizedOriginal = normalizeReferenceName(input.originalName);
    const byOriginal = rows.find(
      (row) =>
        row.type === type && normalizeReferenceName(row.name) === normalizedOriginal,
    );
    if (byOriginal) return byOriginal;
  }

  return null;
}

function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

function buildReferencePatch(
  existing: ReferenceRow,
  input: NormalizedReferenceInput,
): Partial<typeof ReferenceItem.$inferInsert> {
  const patch: Partial<typeof ReferenceItem.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (!existing.slug && input.slug) patch.slug = input.normalizedSlug ?? input.slug;
  if (patch.slug) patch.slugNormalized = slugify(patch.slug);
  if (!existing.originalName && input.originalName) patch.originalName = input.originalName;
  if (!existing.description && input.description) patch.description = input.description;
  if (!existing.shortDescription && input.shortDescription) {
    patch.shortDescription = input.shortDescription;
  }
  if (!existing.coverImage && input.imageUrl) patch.coverImage = input.imageUrl;
  if (!existing.bannerImage && input.bannerImageUrl) patch.bannerImage = input.bannerImageUrl;
  if (!existing.imageFilename && input.imageFilename) {
    patch.imageFilename = input.imageFilename;
  }
  if (!existing.website && input.website) patch.website = input.website;
  if (!existing.countryName && input.countryName) patch.countryName = input.countryName;
  if (!existing.countrySlug && input.countrySlug) patch.countrySlug = input.countrySlug;
  if (!existing.sourceName && input.sourceName) patch.sourceName = input.sourceName;
  if (!existing.sourceUrl && input.sourceUrl) patch.sourceUrl = input.sourceUrl;
  if (!existing.seoTitle && input.seoTitle) patch.seoTitle = input.seoTitle;
  if (!existing.seoDescription && input.seoDescription) {
    patch.seoDescription = input.seoDescription;
  }
  if (!existing.birthYear && input.birthYear != null) patch.birthYear = input.birthYear;
  if (!existing.deathYear && input.deathYear != null) patch.deathYear = input.deathYear;
  if (!existing.metadata && input.metadata) patch.metadata = input.metadata;

  if (input.status === "APPROVED" && existing.status === "PENDING") {
    patch.status = "APPROVED";
  }

  return patch;
}

function assertNoSuspiciousMultiValueName(
  type: ReferenceTypeValue,
  input: NormalizedReferenceInput,
) {
  if (type !== "GENRE") return;

  if (hasMultiValueSeparator(input.name) && splitMultiValueText(input.name).length > 1) {
    throw new ReferenceError(
      "نام ژانر شامل چند مقدار است و باید قبل از ثبت جدا شود",
      422,
      "MULTI_VALUE_GENRE_REFERENCE",
    );
  }
}

export async function previewResolveReferenceItem(
  executor: ReferenceExecutor,
  options: {
    type: ReferenceTypeValue;
    input: ImportReferenceInput;
    cache?: ReferenceResolutionCache;
  },
): Promise<ResolvedReferenceItem | null> {
  const normalized = normalizeReferenceInput(options.input);
  if (!normalized) return null;
  assertNoSuspiciousMultiValueName(options.type, normalized);

  const cached = options.cache
    ? candidateCacheKeys(options.type, normalized)
        .map((key) => options.cache!.byKey.get(key))
        .find(Boolean)
    : undefined;
  if (cached) return { ...cached, resolution: "reused" };

  const rows = await loadReferenceRows(executor, options.type, options.cache);
  const existing = findReferenceMatch(rows, options.type, normalized);
  if (!existing) {
    const preview: ResolvedReferenceItem = {
      id: normalized.id ?? `preview:${options.type}:${normalized.normalizedName}`,
      type: options.type,
      name: normalized.name,
      slug: normalized.normalizedSlug ?? null,
      coverImage: normalized.imageUrl ?? null,
      bannerImage: normalized.bannerImageUrl ?? null,
      originalName: normalized.originalName ?? null,
      description: normalized.description ?? null,
      shortDescription: normalized.shortDescription ?? null,
      imageFilename: normalized.imageFilename ?? null,
      sourceName: normalized.sourceName ?? null,
      sourceUrl: normalized.sourceUrl ?? null,
      seoTitle: normalized.seoTitle ?? null,
      seoDescription: normalized.seoDescription ?? null,
      birthYear: normalized.birthYear ?? null,
      deathYear: normalized.deathYear ?? null,
      countryName: normalized.countryName ?? null,
      countrySlug: normalized.countrySlug ?? null,
      website: normalized.website ?? null,
      metadata: normalized.metadata ?? null,
      status: normalized.status ?? "APPROVED",
      createdAt: new Date(0),
      resolution: "created",
    };
    hydrateCache(options.cache, options.type, normalized, preview);
    return preview;
  }

  const patch = buildReferencePatch(existing, normalized);
  const preview: ResolvedReferenceItem = {
    ...toDto(existing),
    resolution:
      Object.keys(patch).filter((key) => key !== "updatedAt").length > 0
        ? "updated"
        : "reused",
  };
  hydrateCache(options.cache, options.type, normalized, preview);
  return preview;
}

export async function resolveReferenceItem(
  executor: ReferenceExecutor,
  options: {
    type: ReferenceTypeValue;
    input: ImportReferenceInput;
    cache?: ReferenceResolutionCache;
    createdById?: string | null;
    defaultStatus?: "PENDING" | "APPROVED" | "REJECTED";
  },
): Promise<ResolvedReferenceItem | null> {
  const normalized = normalizeReferenceInput(options.input);
  if (!normalized) return null;
  assertNoSuspiciousMultiValueName(options.type, normalized);

  const cached = options.cache
    ? candidateCacheKeys(options.type, normalized)
        .map((key) => options.cache!.byKey.get(key))
        .find(Boolean)
    : undefined;
  if (cached && !String(cached.id).startsWith("preview:")) {
    return { ...cached, resolution: "reused" };
  }

  const rows = await loadReferenceRows(executor, options.type, options.cache);
  const existing = findReferenceMatch(rows, options.type, normalized);

  if (existing) {
    const patch = buildReferencePatch(existing, {
      ...normalized,
      status: normalized.status ?? options.defaultStatus,
    });
    const keys = Object.keys(patch).filter((key) => key !== "updatedAt");
    if (keys.length > 0) {
      const [updated] = await executor
        .update(ReferenceItem)
        .set(patch)
        .where(eq(ReferenceItem.id, existing.id))
        .returning();
      const resolved: ResolvedReferenceItem = {
        ...toDto(updated),
        resolution: "updated",
      };
      updateTypeCache(options.cache, updated);
      hydrateCache(options.cache, options.type, normalized, resolved);
      return resolved;
    }

    const resolved: ResolvedReferenceItem = {
      ...toDto(existing),
      resolution: "reused",
    };
    hydrateCache(options.cache, options.type, normalized, resolved);
    return resolved;
  }

  const slug =
    normalized.normalizedSlug ??
    (await uniqueReferenceSlug(options.type, normalized.name, undefined, executor));

  const [created] = await executor
    .insert(ReferenceItem)
    .values({
      type: options.type,
      name: normalized.name,
      slug,
      slugNormalized: slugify(slug),
      coverImage: normalized.imageUrl ?? null,
      bannerImage: normalized.bannerImageUrl ?? null,
      originalName: normalized.originalName ?? null,
      description: normalized.description ?? null,
      shortDescription: normalized.shortDescription ?? null,
      imageFilename: normalized.imageFilename ?? null,
      sourceName: normalized.sourceName ?? null,
      sourceUrl: normalized.sourceUrl ?? null,
      seoTitle: normalized.seoTitle ?? null,
      seoDescription: normalized.seoDescription ?? null,
      birthYear: normalized.birthYear ?? null,
      deathYear: normalized.deathYear ?? null,
      countryName: normalized.countryName ?? null,
      countrySlug: normalized.countrySlug ?? null,
      website: normalized.website ?? null,
      metadata: normalized.metadata ?? null,
      status: normalized.status ?? options.defaultStatus ?? "APPROVED",
      createdById: options.createdById ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    const resolved: ResolvedReferenceItem = {
      ...toDto(created),
      resolution: "created",
    };
    updateTypeCache(options.cache, created);
    hydrateCache(options.cache, options.type, normalized, resolved);
    return resolved;
  }

  const refreshedRows = await loadReferenceRows(executor, options.type);
  const conflictWinner = findReferenceMatch(refreshedRows, options.type, normalized);
  if (!conflictWinner) {
    throw new ReferenceError("ثبت آیتم مرجع ناموفق بود", 500, "REFERENCE_RESOLVE_FAILED");
  }

  const resolved: ResolvedReferenceItem = {
    ...toDto(conflictWinner),
    resolution: "reused",
  };
  updateTypeCache(options.cache, conflictWinner);
  hydrateCache(options.cache, options.type, normalized, resolved);
  return resolved;
}

export async function searchReference(
  type: ReferenceTypeValue,
  q: string,
  { approvedOnly = true, limit = 20 } = {},
): Promise<ReferenceItemDTO[]> {
  const conds = [eq(ReferenceItem.type, type)];
  if (approvedOnly) conds.push(eq(ReferenceItem.status, "APPROVED"));
  if (q.trim()) conds.push(ilike(ReferenceItem.name, `%${q.trim()}%`));

  const rows = await db
    .select(REFERENCE_COLUMNS)
    .from(ReferenceItem)
    .where(and(...conds))
    .orderBy(ReferenceItem.name)
    .limit(limit);

  return rows.map((row) => toDto(row as ReferenceRow));
}

export async function searchReferencePage(
  type: ReferenceTypeValue,
  q: string,
  {
    approvedOnly = true,
    page = 1,
    pageSize = 20,
  }: {
    approvedOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ReferenceSearchPage> {
  const safePageSize = Math.max(1, Math.min(100, Math.trunc(pageSize)));
  const safePage = Math.max(1, Math.trunc(page));
  const conds = [eq(ReferenceItem.type, type)];
  if (approvedOnly) conds.push(eq(ReferenceItem.status, "APPROVED"));
  if (q.trim()) conds.push(ilike(ReferenceItem.name, `%${q.trim()}%`));

  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ReferenceItem)
      .where(and(...conds)),
    db
      .select(REFERENCE_COLUMNS)
      .from(ReferenceItem)
      .where(and(...conds))
      .orderBy(ReferenceItem.name)
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize),
  ]);

  const totalCount = countRows[0]?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / safePageSize));
  const normalizedPage = Math.min(safePage, pageCount);

  return {
    items: rows.map((row) => toDto(row as ReferenceRow)),
    totalCount,
    page: normalizedPage,
    pageSize: safePageSize,
    pageCount,
  };
}

export async function ensureReferenceItem(
  type: ReferenceTypeValue,
  name: string,
  userId: string,
): Promise<void> {
  await resolveReferenceItem(db, {
    type,
    input: name,
    createdById: userId,
    defaultStatus: "PENDING",
  });
}

export async function adminListReference(filters: {
  type?: ReferenceTypeValue;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  q?: string;
}): Promise<ReferenceItemDTO[]> {
  const conds = [];
  if (filters.type) conds.push(eq(ReferenceItem.type, filters.type));
  if (filters.status) conds.push(eq(ReferenceItem.status, filters.status));
  if (filters.q?.trim()) {
    conds.push(ilike(ReferenceItem.name, `%${filters.q.trim()}%`));
  }

  const rows = await db
    .select(REFERENCE_COLUMNS)
    .from(ReferenceItem)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(ReferenceItem.createdAt))
    .limit(500);

  return rows as ReferenceItemDTO[];
}

export async function adminCreateReference(
  type: ReferenceTypeValue,
  name: string,
): Promise<ReferenceItemDTO> {
  const resolved = await resolveReferenceItem(db, {
    type,
    input: name,
    defaultStatus: "APPROVED",
  });

  if (!resolved) {
    throw new ReferenceError("نام مرجع نامعتبر است", 422, "INVALID_REFERENCE_NAME");
  }

  return resolved;
}

export async function adminUpdateReference(
  id: string,
  input: UpdateReferenceInput,
): Promise<void> {
  const [current] = await db
    .select({ type: ReferenceItem.type, slug: ReferenceItem.slug })
    .from(ReferenceItem)
    .where(eq(ReferenceItem.id, id))
    .limit(1);
  if (!current) throw new ReferenceError("مورد یافت نشد", 404);

  const set: Partial<typeof ReferenceItem.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) set.name = input.name.trim();
  if (input.coverImage !== undefined) set.coverImage = input.coverImage || null;
  if (input.bannerImage !== undefined) set.bannerImage = input.bannerImage || null;
  if (input.description !== undefined) set.description = input.description || null;
  if (input.originalName !== undefined) set.originalName = input.originalName || null;
  if (input.shortDescription !== undefined) {
    set.shortDescription = input.shortDescription || null;
  }
  if (input.imageFilename !== undefined) set.imageFilename = input.imageFilename || null;
  if (input.sourceName !== undefined) set.sourceName = input.sourceName || null;
  if (input.sourceUrl !== undefined) set.sourceUrl = input.sourceUrl || null;
  if (input.seoTitle !== undefined) set.seoTitle = input.seoTitle || null;
  if (input.seoDescription !== undefined) {
    set.seoDescription = input.seoDescription || null;
  }
  if (input.birthYear !== undefined) set.birthYear = input.birthYear ?? null;
  if (input.deathYear !== undefined) set.deathYear = input.deathYear ?? null;
  if (input.countryName !== undefined) set.countryName = input.countryName || null;
  if (input.countrySlug !== undefined) set.countrySlug = input.countrySlug || null;
  if (input.website !== undefined) set.website = input.website || null;
  if (input.status !== undefined) set.status = input.status;

  if (input.slug !== undefined && input.slug.trim()) {
    set.slug = await uniqueReferenceSlug(current.type, input.slug, id);
  } else if (!current.slug && (input.name || set.name)) {
    set.slug = await uniqueReferenceSlug(
      current.type,
      (set.name as string) ?? "",
      id,
    );
  }
  if (set.slug) set.slugNormalized = slugify(set.slug);

  await db.update(ReferenceItem).set(set).where(eq(ReferenceItem.id, id));
}

export async function adminDeleteReference(id: string): Promise<void> {
  await db.delete(ReferenceItem).where(eq(ReferenceItem.id, id));
}
