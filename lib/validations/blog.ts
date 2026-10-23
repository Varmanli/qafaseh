import { z } from "zod";
import { normalizeMediaUrl } from "@/lib/book/cover";
import { isAllowedPersistedImageUrl } from "@/lib/storage/image-url";

const relationIdsSchema = z.array(z.string().uuid()).max(30).refine((ids) => new Set(ids).size === ids.length, "ارتباط تکراری مجاز نیست");

export const blogPostStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

export const blogPostInputSchema = z.object({
  title: z.string().min(1, "عنوان نوشته الزامی است").max(500),
  // اسلاگ به‌صورت خودکار در سرویس از عنوان ساخته می‌شود؛ از ادمین گرفته نمی‌شود.
  categoryId: z.string().min(1, "انتخاب دسته‌بندی الزامی است"),
  excerpt: z.string().min(1, "خلاصه کوتاه الزامی است").max(1000),
  content: z.string().min(1, "محتوا الزامی است").max(100000),
  bannerImage: z.string().min(1, "تصویر بنر الزامی است").max(5000),
  status: blogPostStatusSchema.default("DRAFT"),
  publishedAt: z.string().datetime().optional().nullable(),
  seoTitle: z.string().max(500).optional(),
  seoDescription: z.string().max(1000).optional(),
  canonicalUrl: z.string().url("نشانی canonical معتبر نیست").max(5000).optional(),
  ogImage: z.string().max(5000).optional(),
  relatedBookIds: relationIdsSchema.default([]),
  relatedAuthorIds: relationIdsSchema.default([]),
  relatedGenreIds: relationIdsSchema.default([]),
});

export const adminBlogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().optional().default(""),
  status: z.enum(["ALL", "DRAFT", "PUBLISHED"]).default("ALL"),
});

export const blogCategoryInputSchema = z.object({
  name: z.string().min(1, "نام دسته‌بندی الزامی است").max(200),
  description: z.string().max(1000).optional().nullable(),
  coverImage: z.string().trim().max(5000).refine(
    (value) => !value || (!value.startsWith("//") && normalizeMediaUrl(value) !== null && isAllowedPersistedImageUrl(value)),
    "نشانی تصویر کاور معتبر نیست؛ تصویر را از بخش آپلود انتخاب کنید.",
  ).nullish(),
});

export type BlogPostInput = z.infer<typeof blogPostInputSchema>;
export type BlogCategoryInput = z.infer<typeof blogCategoryInputSchema>;
