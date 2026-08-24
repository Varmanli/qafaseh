import { and, eq, like, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ReferenceItem } from "@/db/schema";
import { slugify } from "@/lib/book/slug";
import {
  normalizeReferenceName,
  type ReferenceItemDTO,
} from "@/lib/reference/service";
import { saveImageUpload } from "@/lib/server/upload-storage";
import {
  getFilenameExtension,
} from "@/lib/server/upload-key";
import { validateImageFile } from "@/lib/upload";
import { REFERENCE_DESCRIPTION_LIMITS } from "@/lib/reference/limits";
import type { ReferenceTypeValue } from "@/lib/validations/reference";

export const SUPPORTED_REFERENCE_PROFILE_TYPES = [
  "AUTHOR",
  "TRANSLATOR",
  "PUBLISHER",
] as const;

export type SupportedReferenceProfileType =
  (typeof SUPPORTED_REFERENCE_PROFILE_TYPES)[number];

export const REFERENCE_PROFILE_IMAGE_MAX_BYTES = 500 * 1024;

const supportedTypeSchema = z.enum(SUPPORTED_REFERENCE_PROFILE_TYPES);

const countrySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(200).nullish(),
  })
  .partial()
  .transform((value) => {
    const name = value.name?.trim();
    if (!name) return null;
    const slug = value.slug?.trim();
    return {
      name,
      slug: slug ? slugify(slug) || slug : slugify(name) || null,
    };
  });

const nullableString = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, max) : null;
    });

const nullableUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  })
  .refine((value) => value == null || z.url().safeParse(value).success, {
    message: "آدرس معتبر نیست",
  });

const nullableYear = z
  .union([z.number().int(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "number" ? value : null))
  .refine((value) => value == null || (value >= 0 && value <= 2100), {
    message: "سال واردشده معتبر نیست",
  });

const profileSchema = z
  .object({
    type: supportedTypeSchema,
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(200).nullish(),
    originalName: nullableString(200),
    description: nullableString(REFERENCE_DESCRIPTION_LIMITS.full),
    shortDescription: nullableString(REFERENCE_DESCRIPTION_LIMITS.short),
    imageFilename: nullableString(255),
    imageUrl: nullableUrl,
    sourceName: nullableString(200),
    sourceUrl: nullableUrl,
    seoTitle: nullableString(255),
    seoDescription: nullableString(180),
    website: nullableUrl,
    birthYear: nullableYear,
    deathYear: nullableYear,
    country: countrySchema.nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.deathYear != null && value.birthYear != null && value.deathYear < value.birthYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deathYear"],
        message: "سال وفات نمی‌تواند قبل از سال تولد باشد",
      });
    }
  })
  .transform((value) => {
    const slug = value.slug?.trim();
    return {
      ...value,
      slug: slug ? slugify(slug) || slug : slugify(value.name) || null,
      metadata: value.metadata ?? null,
    };
  });

export type ReferenceProfileInput = z.infer<typeof profileSchema>;

export interface ReferenceProfilePreviewItem {
  type: SupportedReferenceProfileType;
  name: string;
  slug: string | null;
  status: "create" | "update" | "invalid";
  matchedReferenceId: string | null;
  warnings: string[];
  errors: string[];
}

export interface ReferenceProfilePreviewResult {
  total: number;
  valid: number;
  invalid: number;
  authors: number;
  translators: number;
  publishers: number;
  willCreate: number;
  willUpdate: number;
  items: ReferenceProfilePreviewItem[];
}

export interface ReferenceProfileApplyResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: Array<{
    type: SupportedReferenceProfileType;
    name: string;
    slug: string | null;
    status: "created" | "updated" | "skipped" | "failed";
    referenceId?: string;
    message?: string;
  }>;
}

export interface ReferenceMediaPreviewResult {
  totalFiles: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  items: Array<{
    filename: string;
    relativePath: string | null;
    matchedReferenceId: string | null;
    referenceName: string | null;
    type: SupportedReferenceProfileType | null;
    status: "matched" | "unmatched" | "ambiguous";
    candidates?: Array<{
      referenceId: string;
      referenceName: string;
      type: SupportedReferenceProfileType;
    }>;
  }>;
}

type ReferenceProfileRow = typeof ReferenceItem.$inferSelect;

function isNonEmptyString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMediaKey(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[ة]/g, "ه")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function pathSegments(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function fileNameFromPath(value: string) {
  const segments = pathSegments(value);
  return segments[segments.length - 1] ?? value;
}

function parseProfilesInput(input: unknown) {
  if (!Array.isArray(input)) {
    return {
      items: [] as ReferenceProfilePreviewItem[],
      validProfiles: [] as ReferenceProfileInput[],
      total: 0,
    };
  }

  const items: ReferenceProfilePreviewItem[] = [];
  const validProfiles: ReferenceProfileInput[] = [];

  for (const raw of input) {
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const candidate =
        raw && typeof raw === "object" && "name" in raw && typeof raw.name === "string"
          ? raw.name
          : "نامشخص";
      const type =
        raw && typeof raw === "object" && "type" in raw && typeof raw.type === "string"
          ? raw.type
          : "AUTHOR";
      items.push({
        type: SUPPORTED_REFERENCE_PROFILE_TYPES.includes(type as SupportedReferenceProfileType)
          ? (type as SupportedReferenceProfileType)
          : "AUTHOR",
        name: candidate,
        slug: null,
        status: "invalid",
        matchedReferenceId: null,
        warnings: [],
        errors: [issue?.message ?? "ورودی معتبر نیست"],
      });
      continue;
    }

    validProfiles.push(parsed.data);
  }

  return { items, validProfiles, total: input.length };
}

async function listReferenceRows(
  type: ReferenceTypeValue,
): Promise<ReferenceProfileRow[]> {
  return db.select().from(ReferenceItem).where(eq(ReferenceItem.type, type));
}

async function listSupportedReferenceRows() {
  const rows = await db
    .select()
    .from(ReferenceItem)
    .where(
      or(
        eq(ReferenceItem.type, "AUTHOR"),
        eq(ReferenceItem.type, "TRANSLATOR"),
        eq(ReferenceItem.type, "PUBLISHER"),
      ),
    );
  return rows as ReferenceProfileRow[];
}

function findExistingReference(
  rows: ReferenceProfileRow[],
  profile: ReferenceProfileInput,
) {
  const normalizedSlug = profile.slug ? slugify(profile.slug) || profile.slug : null;
  if (normalizedSlug) {
    const bySlug = rows.find(
      (row) =>
        row.type === profile.type &&
        row.slug &&
        (slugify(row.slug) || row.slug) === normalizedSlug,
    );
    if (bySlug) return bySlug;
  }

  const normalizedName = normalizeReferenceName(profile.name);
  return (
    rows.find(
      (row) =>
        row.type === profile.type &&
        normalizeReferenceName(row.name) === normalizedName,
    ) ?? null
  );
}

async function uniqueReferenceSlug(
  type: ReferenceTypeValue,
  requested: string,
  excludeId?: string,
) {
  const base = slugify(requested) || "item";
  const rows = await db
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
      .filter((value): value is string => Boolean(value)),
  );

  if (!taken.has(base)) return base;
  for (let i = 2; i < 10000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function chooseString(
  incoming: string | null | undefined,
  existing: string | null | undefined,
  overwrite: boolean,
) {
  if (!isNonEmptyString(incoming)) return undefined;
  if (overwrite || !isNonEmptyString(existing)) return incoming!.trim();
  return undefined;
}

function chooseNumber(
  incoming: number | null | undefined,
  existing: number | null | undefined,
  overwrite: boolean,
) {
  if (incoming == null) return undefined;
  if (overwrite || existing == null) return incoming;
  return undefined;
}

function buildUpdateSet(
  existing: ReferenceProfileRow,
  profile: ReferenceProfileInput,
  overwrite: boolean,
  resolvedCountry?: { name: string; slug: string | null } | null,
): Partial<typeof ReferenceItem.$inferInsert> {
  const set: Partial<typeof ReferenceItem.$inferInsert> = {};

  const slug = chooseString(profile.slug, existing.slug, overwrite);
  if (slug) {
    set.slug = slugify(slug) || slug;
    set.slugNormalized = slugify(set.slug);
  }

  const originalName = chooseString(
    profile.originalName,
    existing.originalName,
    overwrite,
  );
  if (originalName !== undefined) set.originalName = originalName;

  const description = chooseString(
    profile.description,
    existing.description,
    overwrite,
  );
  if (description !== undefined) set.description = description;

  const shortDescription = chooseString(
    profile.shortDescription,
    existing.shortDescription,
    overwrite,
  );
  if (shortDescription !== undefined) set.shortDescription = shortDescription;

  const coverImage = chooseString(profile.imageUrl, existing.coverImage, overwrite);
  if (coverImage !== undefined) set.coverImage = coverImage;

  const imageFilename = chooseString(
    profile.imageFilename,
    existing.imageFilename,
    overwrite,
  );
  if (imageFilename !== undefined) set.imageFilename = fileNameFromPath(imageFilename);

  const sourceName = chooseString(profile.sourceName, existing.sourceName, overwrite);
  if (sourceName !== undefined) set.sourceName = sourceName;

  const sourceUrl = chooseString(profile.sourceUrl, existing.sourceUrl, overwrite);
  if (sourceUrl !== undefined) set.sourceUrl = sourceUrl;

  const seoTitle = chooseString(profile.seoTitle, existing.seoTitle, overwrite);
  if (seoTitle !== undefined) set.seoTitle = seoTitle;

  const seoDescription = chooseString(
    profile.seoDescription,
    existing.seoDescription,
    overwrite,
  );
  if (seoDescription !== undefined) set.seoDescription = seoDescription;

  const website = chooseString(profile.website, existing.website, overwrite);
  if (website !== undefined) set.website = website;

  const birthYear = chooseNumber(profile.birthYear, existing.birthYear, overwrite);
  if (birthYear !== undefined) set.birthYear = birthYear;

  const deathYear = chooseNumber(profile.deathYear, existing.deathYear, overwrite);
  if (deathYear !== undefined) set.deathYear = deathYear;

  const countryName = chooseString(
    resolvedCountry?.name ?? profile.country?.name,
    existing.countryName,
    overwrite,
  );
  if (countryName !== undefined) set.countryName = countryName;

  const countrySlug = chooseString(
    resolvedCountry?.slug ?? profile.country?.slug,
    existing.countrySlug,
    overwrite,
  );
  if (countrySlug !== undefined) set.countrySlug = countrySlug;

  if (profile.metadata && (overwrite || !existing.metadata)) {
    set.metadata = profile.metadata;
  }

  if (Object.keys(set).length > 0) {
    set.updatedAt = new Date();
  }

  return set;
}

async function ensureCountryReference(profile: ReferenceProfileInput) {
  if (!profile.country?.name) return null;

  const countrySlug = profile.country.slug || slugify(profile.country.name) || null;
  const countryRows = await listReferenceRows("COUNTRY");
  const existing =
    (countrySlug
      ? countryRows.find(
          (row) =>
            row.slug && (slugify(row.slug) || row.slug) === countrySlug,
        )
      : null) ??
    countryRows.find(
      (row) =>
        normalizeReferenceName(row.name) === normalizeReferenceName(profile.country!.name),
    ) ??
    null;

  if (existing) {
    return { name: existing.name, slug: existing.slug };
  }

  const slug = countrySlug
    ? await uniqueReferenceSlug("COUNTRY", countrySlug)
    : await uniqueReferenceSlug("COUNTRY", profile.country.name);

  const [created] = await db
    .insert(ReferenceItem)
    .values({
      type: "COUNTRY",
      name: profile.country.name,
      slug,
      slugNormalized: slugify(slug),
      status: "APPROVED",
      updatedAt: new Date(),
    })
    .returning({
      name: ReferenceItem.name,
      slug: ReferenceItem.slug,
    });

  return created ?? { name: profile.country.name, slug };
}

function countTypes(items: ReferenceProfileInput[]) {
  return {
    authors: items.filter((item) => item.type === "AUTHOR").length,
    translators: items.filter((item) => item.type === "TRANSLATOR").length,
    publishers: items.filter((item) => item.type === "PUBLISHER").length,
  };
}

export async function previewReferenceProfiles(
  input: unknown,
): Promise<ReferenceProfilePreviewResult> {
  const parsed = parseProfilesInput(input);
  if (!Array.isArray(input)) {
    return {
      total: 0,
      valid: 0,
      invalid: 1,
      authors: 0,
      translators: 0,
      publishers: 0,
      willCreate: 0,
      willUpdate: 0,
      items: [
        {
          type: "AUTHOR",
          name: "نامشخص",
          slug: null,
          status: "invalid",
          matchedReferenceId: null,
          warnings: [],
          errors: ["فایل باید آرایه‌ای از پروفایل‌ها باشد"],
        },
      ],
    };
  }

  const rows = await listSupportedReferenceRows();
  const items = [...parsed.items];
  let willCreate = 0;
  let willUpdate = 0;

  for (const profile of parsed.validProfiles) {
    const matched = findExistingReference(rows, profile);
    const warnings: string[] = [];

    if (profile.country?.name) {
      const countryRows = await listReferenceRows("COUNTRY");
      const hasCountry = countryRows.some(
        (row) =>
          normalizeReferenceName(row.name) === normalizeReferenceName(profile.country!.name),
      );
      if (!hasCountry) warnings.push("کشور مرجع هنوز وجود ندارد و هنگام ثبت ساخته می‌شود.");
    }

    items.push({
      type: profile.type,
      name: profile.name,
      slug: profile.slug,
      status: matched ? "update" : "create",
      matchedReferenceId: matched?.id ?? null,
      warnings,
      errors: [],
    });

    if (matched) willUpdate += 1;
    else willCreate += 1;
  }

  const counts = countTypes(parsed.validProfiles);
  return {
    total: parsed.total,
    valid: parsed.validProfiles.length,
    invalid: items.filter((item) => item.status === "invalid").length,
    authors: counts.authors,
    translators: counts.translators,
    publishers: counts.publishers,
    willCreate,
    willUpdate,
    items,
  };
}

export async function applyReferenceProfiles(
  input: unknown,
  options?: { overwrite?: boolean },
): Promise<ReferenceProfileApplyResult> {
  const parsed = parseProfilesInput(input);
  const overwrite = options?.overwrite ?? false;

  const result: ReferenceProfileApplyResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: parsed.items.length,
    items: parsed.items.map((item) => ({
      type: item.type,
      name: item.name,
      slug: item.slug,
      status: "failed",
      message: item.errors[0],
    })),
  };

  for (const profile of parsed.validProfiles) {
    try {
      const country = await ensureCountryReference(profile);
      const rows = await listReferenceRows(profile.type);
      const existing = findExistingReference(rows, profile);

      if (existing) {
        const set = buildUpdateSet(existing, profile, overwrite, country);
        if (Object.keys(set).length === 0) {
          result.skipped += 1;
          result.items.push({
            type: profile.type,
            name: profile.name,
            slug: existing.slug,
            referenceId: existing.id,
            status: "skipped",
            message: "فیلد جدیدی برای به‌روزرسانی وجود نداشت.",
          });
          continue;
        }

        await db.update(ReferenceItem).set(set).where(eq(ReferenceItem.id, existing.id));
        result.updated += 1;
        result.items.push({
          type: profile.type,
          name: profile.name,
          slug: existing.slug,
          referenceId: existing.id,
          status: "updated",
        });
        continue;
      }

      const slug = await uniqueReferenceSlug(
        profile.type,
        profile.slug || profile.name,
      );
      const [created] = await db
        .insert(ReferenceItem)
        .values({
          type: profile.type,
          name: profile.name,
          slug,
          slugNormalized: slugify(slug),
          originalName: profile.originalName,
          description: profile.description,
          shortDescription: profile.shortDescription,
          coverImage: profile.imageUrl,
          imageFilename: profile.imageFilename ? fileNameFromPath(profile.imageFilename) : null,
          sourceName: profile.sourceName,
          sourceUrl: profile.sourceUrl,
          seoTitle: profile.seoTitle,
          seoDescription: profile.seoDescription,
          birthYear: profile.birthYear,
          deathYear: profile.deathYear,
          countryName: country?.name ?? profile.country?.name ?? null,
          countrySlug: country?.slug ?? profile.country?.slug ?? null,
          website: profile.website,
          metadata: profile.metadata,
          status: "APPROVED",
          updatedAt: new Date(),
        })
        .returning({
          id: ReferenceItem.id,
          slug: ReferenceItem.slug,
        });

      result.created += 1;
      result.items.push({
        type: profile.type,
        name: profile.name,
        slug: created?.slug ?? slug,
        referenceId: created?.id,
        status: "created",
      });
    } catch (error) {
      result.failed += 1;
      result.items.push({
        type: profile.type,
        name: profile.name,
        slug: profile.slug,
        status: "failed",
        message: error instanceof Error ? error.message : "ثبت این پروفایل ناموفق بود.",
      });
    }
  }

  return result;
}

function deriveReferenceMediaKeys(row: ReferenceProfileRow) {
  const keys = new Set<string>();
  if (row.slug) keys.add(normalizeMediaKey(row.slug));
  if (row.imageFilename) keys.add(normalizeMediaKey(row.imageFilename));
  return [...keys].filter(Boolean);
}

function deriveFileKeys(file: { name: string; relativePath?: string | null }) {
  const keys = new Set<string>();
  keys.add(normalizeMediaKey(file.name));
  const segments = pathSegments(file.relativePath);
  if (segments.length > 1) {
    keys.add(normalizeMediaKey(segments[segments.length - 2]));
  }
  return [...keys].filter(Boolean);
}

export async function previewReferenceMediaMatches(
  files: Array<{ name: string; relativePath?: string | null }>,
): Promise<ReferenceMediaPreviewResult> {
  const rows = await listSupportedReferenceRows();
  const index = new Map<string, ReferenceProfileRow[]>();

  for (const row of rows) {
    for (const key of deriveReferenceMediaKeys(row)) {
      const bucket = index.get(key) ?? [];
      bucket.push(row);
      index.set(key, bucket);
    }
  }

  const items: ReferenceMediaPreviewResult["items"] = [];

  for (const file of files) {
    const candidates = deriveFileKeys(file)
      .flatMap((key) => index.get(key) ?? [])
      .filter((row, idx, arr) => arr.findIndex((item) => item.id === row.id) === idx);

    if (candidates.length === 1) {
      const candidate = candidates[0];
      items.push({
        filename: file.name,
        relativePath: file.relativePath ?? null,
        matchedReferenceId: candidate.id,
        referenceName: candidate.name,
        type: candidate.type as SupportedReferenceProfileType,
        status: "matched",
      });
      continue;
    }

    if (candidates.length > 1) {
      items.push({
        filename: file.name,
        relativePath: file.relativePath ?? null,
        matchedReferenceId: null,
        referenceName: null,
        type: null,
        status: "ambiguous",
        candidates: candidates.map((candidate) => ({
          referenceId: candidate.id,
          referenceName: candidate.name,
          type: candidate.type as SupportedReferenceProfileType,
        })),
      });
      continue;
    }

    items.push({
      filename: file.name,
      relativePath: file.relativePath ?? null,
      matchedReferenceId: null,
      referenceName: null,
      type: null,
      status: "unmatched",
    });
  }

  return {
    totalFiles: files.length,
    matched: items.filter((item) => item.status === "matched").length,
    unmatched: items.filter((item) => item.status === "unmatched").length,
    ambiguous: items.filter((item) => item.status === "ambiguous").length,
    items,
  };
}

export function buildReferenceImageUploadKey(
  _reference: Pick<ReferenceItemDTO, "type" | "slug" | "imageFilename">,
  fileName: string,
) {
  const extension = getFilenameExtension(fileName) || ".jpg";
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `references/${year}/${month}/${crypto.randomUUID()}${extension}`;
}

export async function uploadReferenceMedia(
  files: File[],
  matches: Array<{ filename: string; relativePath?: string | null; referenceId: string }>,
) {
  const rows = await db
    .select({
      id: ReferenceItem.id,
      type: ReferenceItem.type,
      slug: ReferenceItem.slug,
      name: ReferenceItem.name,
      imageFilename: ReferenceItem.imageFilename,
      metadata: ReferenceItem.metadata,
    })
    .from(ReferenceItem)
    .where(
      or(
        ...matches.map((match) => eq(ReferenceItem.id, match.referenceId)),
      ),
    );

  const byId = new Map(rows.map((row) => [row.id, row]));
  const fileLookup = new Map(
    files.map((file, index) => {
      const relativePath =
        matches[index]?.relativePath ?? null;
      return [`${file.name}::${relativePath ?? ""}`, file] as const;
    }),
  );

  const uploaded: Array<{
    filename: string;
    referenceId: string;
    imageUrl: string;
  }> = [];
  const skipped: Array<{
    filename: string;
    reason: string;
  }> = [];

  for (const match of matches) {
    const file = fileLookup.get(`${match.filename}::${match.relativePath ?? ""}`);
    const row = byId.get(match.referenceId);
    if (!file || !row || !row.slug) {
      skipped.push({
        filename: match.filename,
        reason: "مرجع مقصد برای این فایل پیدا نشد.",
      });
      continue;
    }

    const validationError = validateImageFile(file, REFERENCE_PROFILE_IMAGE_MAX_BYTES);
    if (validationError) {
      skipped.push({ filename: file.name, reason: validationError });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await saveImageUpload({
      buffer,
      contentType: file.type,
      filename: file.name,
      folder: "references",
      objectKey: buildReferenceImageUploadKey(row, file.name),
    });

    await db
      .update(ReferenceItem)
      .set({
        coverImage: upload.url,
        imageFilename: row.imageFilename || fileNameFromPath(file.name),
        metadata: { ...(row.metadata ?? {}), imageObjectKey: upload.key },
        updatedAt: new Date(),
      })
      .where(eq(ReferenceItem.id, row.id));

    uploaded.push({
      filename: file.name,
      referenceId: row.id,
      imageUrl: upload.url,
    });
  }

  return {
    uploaded,
    skipped,
    imagesUploaded: uploaded.length,
    unmatchedImages: skipped.length,
  };
}
