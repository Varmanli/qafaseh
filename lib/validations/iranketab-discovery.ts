import { z } from "zod";

export const iranKetabDiscoverySourceTypeSchema = z.enum([
  "AWARD",
  "CURATED_LIST",
  "EDITORIAL_COLLECTION",
  "AUTHOR",
  "PUBLISHER",
  "TAG",
  "SEARCH",
]);

export const iranKetabDiscoveryCrawlStatusSchema = z.enum([
  "IDLE",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "PAUSED",
]);

const metadataSchema = z.record(z.string(), z.unknown());
export const iranKetabDiscoveryImportModeSchema = z.enum(["MANUAL_REVIEW", "AUTO_IMPORT"]);

export const iranKetabDiscoverySourceInputSchema = z.object({
  name: z.string().trim().min(1, "نام منبع الزامی است").max(300),
  sourceType: iranKetabDiscoverySourceTypeSchema,
  sourceUrl: z
    .string()
    .trim()
    .url("نشانی منبع معتبر نیست")
    .max(2048)
    .refine(isIranKetabDiscoveryUrl, "نشانی باید متعلق به سایت ایران‌کتاب باشد"),
  sourceKey: z
    .string()
    .trim()
    .min(1, "کلید پایدار منبع الزامی است")
    .max(120)
    .regex(
      /^[a-z0-9][a-z0-9:_-]*$/,
      "کلید منبع فقط می‌تواند شامل حروف کوچک انگلیسی، عدد، :، _ و - باشد",
    ),
  importance: z.number().int().min(0).max(100).default(50),
  enabled: z.boolean().default(true),
  crawlIntervalMinutes: z.number().int().min(5).max(43_200).default(1440),
  autoQueue: z.boolean().default(false),
  importMode: iranKetabDiscoveryImportModeSchema.default("MANUAL_REVIEW"),
  minimumQueueScore: z.number().int().min(0).max(100).default(85),
  parserVersion: z.number().int().positive().max(10_000).default(1),
  nextCrawlAt: z.coerce.date().nullable().optional(),
  metadata: metadataSchema.nullable().optional(),
});

export const iranKetabPublisherImportSchema = z.object({
  url: z.string().trim().min(1, "لینک انتشارات الزامی است").max(2048),
});

export const iranKetabPublisherControlSchema = z.object({
  sourceId: z.string().trim().min(1, "شناسهٔ منبع الزامی است").max(255),
  action: z.enum(["PAUSE", "RESUME", "RETRY_FAILED"]),
});

export const updateIranKetabDiscoverySourceSchema =
  iranKetabDiscoverySourceInputSchema
    .omit({ enabled: true })
    .partial()
    .refine((value) => Object.keys(value).length > 0, "حداقل یک فیلد باید تغییر کند");

export const setIranKetabDiscoverySourceEnabledSchema = z.object({
  enabled: z.boolean(),
});

/** Omitting sourceId runs the normal due-source scheduler pass. */
export const runIranKetabDiscoverySchema = z.object({
  sourceId: z.string().trim().min(1).max(255).optional(),
});

export const listIranKetabDiscoverySourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(300).default(""),
  sourceType: z
    .enum(["ALL", ...iranKetabDiscoverySourceTypeSchema.options])
    .default("ALL"),
  crawlStatus: z
    .enum(["ALL", ...iranKetabDiscoveryCrawlStatusSchema.options])
    .default("ALL"),
  enabled: z.enum(["ALL", "true", "false"]).default("ALL"),
});

export const iranKetabDiscoveryItemStatusSchema = z.enum([
  "DISCOVERED",
  "SCORED",
  "QUEUED",
  "IMPORTING",
  "IMPORTED",
  "NEEDS_REVIEW",
  "APPROVED",
  "SKIPPED",
  "FAILED",
]);

export const iranKetabDiscoveryImportConfidenceSchema = z.enum([
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const listIranKetabDiscoveryItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(300).default(""),
  status: z
    .enum(["ALL", ...iranKetabDiscoveryItemStatusSchema.options])
    .default("ALL"),
  importConfidence: z
    .enum(["ALL", ...iranKetabDiscoveryImportConfidenceSchema.options])
    .default("ALL"),
  minimumPriorityScore: z.coerce.number().int().min(0).max(100).default(0),
  sourceId: z.string().trim().min(1).max(255).optional(),
});

export const iranKetabDiscoveryCandidateActionSchema = z.object({
  action: z.enum(["IGNORE", "NEEDS_REVIEW", "APPROVE_FOR_IMPORT"]),
});

export const iranKetabDiscoveryImportJobStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const enqueueIranKetabDiscoveryItemsSchema = z.object({
  discoveryItemIds: z.array(z.string().trim().min(1).max(255)).min(1).max(100),
  discoverySourceId: z.string().trim().min(1).max(255).optional(),
});

export const listIranKetabDiscoveryImportJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(["ALL", ...iranKetabDiscoveryImportJobStatusSchema.options]).default("ALL"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minimumPriority: z.coerce.number().int().min(0).max(100).optional(),
});

export const iranKetabDiscoveryImportJobActionSchema = z.object({
  action: z.enum(["RETRY", "CANCEL"]),
});

export type IranKetabDiscoverySourceInput = z.infer<
  typeof iranKetabDiscoverySourceInputSchema
>;
export type UpdateIranKetabDiscoverySourceInput = z.infer<
  typeof updateIranKetabDiscoverySourceSchema
>;

function isIranKetabDiscoveryUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ["iranketab.ir", "www.iranketab.ir"].includes(
        url.hostname.toLowerCase(),
      )
    );
  } catch {
    return false;
  }
}
