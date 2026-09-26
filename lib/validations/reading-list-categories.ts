import { z } from "zod";

export const readingListCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "نام دسته‌بندی الزامی است").max(100),
});

export type ReadingListCategoryInput = z.infer<typeof readingListCategoryInputSchema>;
