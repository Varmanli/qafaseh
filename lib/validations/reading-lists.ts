import { z } from "zod";
import { slugify } from "@/lib/book/slug";

const ids = z.array(z.string().uuid()).max(20).refine((value) => new Set(value).size === value.length, "لیست مرتبط تکراری است");

export const readingListInputSchema = z.object({
  title: z.string().trim().min(1, "عنوان الزامی است").max(300),
  slug: z.string().trim().min(1, "اسلاگ الزامی است").max(300)
    .refine((value) => slugify(value) === value, "اسلاگ معتبر نیست"),
  description: z.string().trim().min(1, "توضیح الزامی است").max(2000),
  audience: z.string().trim().max(1000).nullable(),
  category: z.string().trim().min(1, "دسته‌بندی الزامی است").max(100),
  hubGroup: z.string().trim().min(1, "گروه الزامی است").max(100),
  mode: z.enum(["ORDERED", "UNORDERED"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  featured: z.boolean(),
  seoTitle: z.string().trim().max(300).nullable(),
  seoDescription: z.string().trim().max(1000).nullable(),
  items: z.array(z.object({
    bookId: z.string().uuid(),
    note: z.string().trim().max(1000).nullable(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable(),
  })).max(100).refine((items) => new Set(items.map((item) => item.bookId)).size === items.length, "کتاب تکراری مجاز نیست"),
  relatedListIds: ids,
});

export type ReadingListInput = z.infer<typeof readingListInputSchema>;
